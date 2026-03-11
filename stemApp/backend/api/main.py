from datetime import datetime, timedelta, timezone
import os
import secrets
from enum import Enum
import bcrypt

from fastapi import FastAPI, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field

from .database import SessionLocal

app = FastAPI(title="STEM-ACT Backend")

cors_origins = os.getenv(
    "CORS_ALLOW_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
allowed_origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/db")
def health_db(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT 1")).scalar()
    now = db.execute(text("SELECT now()")).scalar()

    return {
        "database": "connected",
        "check": result,
        "time": str(now)
    }


class EventStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    denied = "denied"


class OrganizationStatus(str, Enum):
    active = "active"
    pending = "pending"
    disabled = "disabled"


class UserRole(str, Enum):
    super_admin = "super_admin"
    admin = "admin"
    partner = "partner"


class InviteRole(str, Enum):
    super_admin = "super_admin"
    admin = "admin"


class DenyEventRequest(BaseModel):
    comment: str = Field(min_length=1)


class UpdateOrganizationStatusRequest(BaseModel):
    status: OrganizationStatus


class UpdateUserRoleRequest(BaseModel):
    role: UserRole


class InviteUserRequest(BaseModel):
    role: InviteRole


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    orgName: str = Field(min_length=1)
    email: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    password: str = Field(min_length=8)


@app.post("/api/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    result = db.execute(
        text(
            """
            SELECT
                u.email,
                u.password_hash,
                u.role,
                u.org_id,
                u.user_id,
                o.status AS organization_status
            FROM users u
            LEFT JOIN organizations o ON o.org_id = u.org_id
            WHERE lower(u.email) = lower(:email)
            LIMIT 1
            """
        ),
        {"email": payload.email.strip()},
    )
    user = result.mappings().first()

    if user is None:
        return JSONResponse(
            {"success": False, "error": "Invalid email or password"},
            status_code=401,
        )

    password_hash = user["password_hash"].encode("utf-8")
    submitted_password = payload.password.encode("utf-8")
    is_valid = bcrypt.checkpw(submitted_password, password_hash)
    if not is_valid:
        return JSONResponse(
            {"success": False, "error": "Invalid email or password"},
            status_code=401,
        )

    if (
        user["role"] == UserRole.partner.value
        and user["organization_status"] in {"pending", "disabled", "inactive", "rejected"}
    ):
        return JSONResponse(
            {"success": False, "error": "This partner account is not active yet"},
            status_code=403,
        )
    return {
        "success": True,
        "userID": user["user_id"],
        "role": user["role"],
        "orgId": user["org_id"],
    }


@app.post("/api/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    org_name = payload.orgName.strip()
    phone = payload.phone.strip()

    existing = db.execute(
        text("SELECT user_id FROM users WHERE lower(email) = lower(:email) LIMIT 1"),
        {"email": email},
    ).first()
    if existing is not None:
        return JSONResponse(
            {"success": False, "error": "An account with this email already exists"},
            status_code=409,
        )

    try:
        password_hash = bcrypt.hashpw(
            payload.password.encode("utf-8"),
            bcrypt.gensalt(),
        ).decode("utf-8")
        user_name = email.split("@")[0] if "@" in email else email

        org_result = db.execute(
            text(
                """
                INSERT INTO organizations (org_name, contact_email, contact_phone, status)
                VALUES (:org_name, :contact_email, :contact_phone, :status)
                RETURNING org_id
                """
            ),
            {
                "org_name": org_name,
                "contact_email": email,
                "contact_phone": phone,
                "status": OrganizationStatus.pending.value,
            },
        )
        org_row = org_result.mappings().first()
        org_id = org_row["org_id"]

        db.execute(
            text(
                """
                INSERT INTO users (email, password_hash, role, org_id, user_name)
                VALUES (:email, :password_hash, :role, :org_id, :user_name)
                """
            ),
            {
                "email": email,
                "password_hash": password_hash,
                "role": UserRole.partner.value,
                "org_id": org_id,
                "user_name": user_name,
            },
        )
        db.commit()
        return {"success": True}
    except Exception as exc:
        db.rollback()
        return JSONResponse({"success": False, "error": str(exc)}, status_code=500)


@app.post("/api/events/{event_id}/approve")
def approve_event(event_id: int, db: Session = Depends(get_db)):
    result = db.execute(
        text(
            """
            UPDATE events
            SET status = :status, admin_comment = NULL, reviewed_at = now()
            WHERE event_id = :event_id
            RETURNING event_id
            """
        ),
        {"status": EventStatus.approved.value, "event_id": event_id},
    )
    row = result.first()
    db.commit()

    if row is None:
        return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)

    return {"success": True}


@app.post("/api/events/{event_id}/deny")
def deny_event(event_id: int, payload: DenyEventRequest, db: Session = Depends(get_db)):
    if not payload.comment.strip():
        return JSONResponse(
            {"success": False, "message": "Comment is required when denying an event"},
            status_code=400,
        )
    result = db.execute(
        text(
            """
            UPDATE events
            SET status = :status, admin_comment = :comment, reviewed_at = now()
            WHERE event_id = :event_id
            RETURNING event_id
            """
        ),
        {"status": EventStatus.denied.value, "comment": payload.comment.strip(), "event_id": event_id},
    )
    row = result.first()
    db.commit()

    if row is None:
        return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)

    return {"success": True}


@app.post("/api/events/{event_id}/revoke")
def revoke_event(event_id: int, db: Session = Depends(get_db)):
    result = db.execute(
        text(
            """
            UPDATE events
            SET status = :status, admin_comment = NULL, reviewed_at = now()
            WHERE event_id = :event_id
            RETURNING event_id
            """
        ),
        {"status": EventStatus.pending.value, "event_id": event_id},
    )
    row = result.first()
    db.commit()

    if row is None:
        return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)

    return {"success": True}


@app.post("/api/organizations/{org_id}/status")
def update_organization_status(
    org_id: int, payload: UpdateOrganizationStatusRequest, db: Session = Depends(get_db)
):
    result = db.execute(
        text("UPDATE organizations SET status = :status WHERE org_id = :org_id RETURNING *"),
        {"status": payload.status.value, "org_id": org_id},
    )
    row = result.mappings().first()
    db.commit()

    if row is None:
        return JSONResponse({"success": False, "message": "Organization not found"}, status_code=404)

    return {"success": True, "organization": dict(row)}


@app.post("/api/users/{user_id}/role")
def update_user_role(user_id: int, payload: UpdateUserRoleRequest, db: Session = Depends(get_db)):
    # Enforce single super_admin rule from current UI logic.
    if payload.role == UserRole.super_admin:
        existing = db.execute(
            text("SELECT email FROM users WHERE role = :role AND user_id != :user_id LIMIT 1"),
            {"role": UserRole.super_admin.value, "user_id": user_id},
        ).mappings().first()
        if existing is not None:
            return JSONResponse(
                {
                    "success": False,
                    "message": f"{existing['email']} is already the super administrator. Remove their role first.",
                },
                status_code=409,
            )

    result = db.execute(
        text("UPDATE users SET role = :role WHERE user_id = :user_id RETURNING user_id"),
        {"role": payload.role.value, "user_id": user_id},
    )
    row = result.first()
    db.commit()

    if row is None:
        return JSONResponse({"success": False, "message": "User not found"}, status_code=404)

    return {"success": True}


@app.post("/api/users/{user_id}/delete")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    target = db.execute(
        text("SELECT user_id, role FROM users WHERE user_id = :user_id"),
        {"user_id": user_id},
    ).mappings().first()

    if target is None:
        return JSONResponse({"success": False, "message": "User not found"}, status_code=404)

    if target["role"] == UserRole.super_admin.value:
        super_admin_count = db.execute(
            text("SELECT COUNT(*) FROM users WHERE role = :role"),
            {"role": UserRole.super_admin.value},
        ).scalar()
        if int(super_admin_count or 0) <= 1:
            return JSONResponse(
                {"success": False, "message": "Cannot delete the last super administrator."},
                status_code=403,
            )

    db.execute(text("DELETE FROM users WHERE user_id = :user_id"), {"user_id": user_id})
    db.commit()
    return {"success": True}


@app.post("/api/users/invite")
def invite_user(payload: InviteUserRequest, db: Session = Depends(get_db)):
    token = secrets.token_hex(24)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=48)
    base_url = os.getenv("APP_BASE_URL", "http://localhost:3000")
    invite_link = f"{base_url}/register?token={token}&role={payload.role.value}"

    db.execute(
        text(
            """
            INSERT INTO invitations (token, role, expires_at)
            VALUES (:token, :role, :expires_at)
            """
        ),
        {"token": token, "role": payload.role.value, "expires_at": expires_at},
    )
    db.commit()

    return {
        "success": True,
        "inviteLink": invite_link,
        "expiresAt": expires_at.isoformat(),
    }
