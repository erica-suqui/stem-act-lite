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
    partner = "partner"


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
    firstName: str = Field(min_length=1)
    lastName: str = Field(min_length=1)
    orgName: str = Field(min_length=1)
    email: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    password: str = Field(min_length=8)
    inviteToken: str = None


class SubmitEventRequest(BaseModel):
    # Partner fields (optional for public users)
    org_id: int = None
    submitted_by_user_id: int = None
    # Public submitter contact (required when org_id is absent)
    submitter_name: str = None
    submitter_email: str = None
    submitter_phone: str = None
    # Event fields
    title: str
    description: str
    start_datetime: str
    end_datetime: str = None
    address: str
    city: str
    county: str
    audience: str = None
    cost: str = None
    hyperlink: str = None
    event_contact: str = None


class EditEventRequest(BaseModel):
    title: str = None
    description: str = None
    start_datetime: str = None
    end_datetime: str = None
    address: str = None
    city: str = None
    county: str = None
    audience: str = None
    cost: str = None
    hyperlink: str = None
    event_contact: str = None


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
    first_name = payload.firstName.strip()
    last_name = payload.lastName.strip()
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
                INSERT INTO organizations (
                    org_name,
                    contact_first_name,
                    contact_last_name,
                    contact_email,
                    contact_phone,
                    status
                )
                VALUES (
                    :org_name,
                    :contact_first_name,
                    :contact_last_name,
                    :contact_email,
                    :contact_phone,
                    :status
                )
                RETURNING org_id
                """
            ),
            {
                "org_name": org_name,
                "contact_first_name": first_name,
                "contact_last_name": last_name,
                "contact_email": email,
                "contact_phone": phone,
                "status": OrganizationStatus.pending.value,
            },
        )
        org_row = org_result.mappings().first()
        org_id = org_row["org_id"]

        user_result = db.execute(
            text(
                """
                INSERT INTO users (email, password_hash, role, org_id, user_name)
                VALUES (:email, :password_hash, :role, :org_id, :user_name)
                RETURNING user_id
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
        user_id = user_result.scalar()

        if payload.inviteToken:
            db.execute(
                text("""
                    UPDATE invitations
                    SET consumed_at = now()
                    WHERE token = :token AND consumed_at IS NULL
                """),
                {"token": payload.inviteToken},
            )

        db.commit()
        return {"success": True, "user_id": user_id, "org_id": org_id}
    except Exception as exc:
        db.rollback()
        return JSONResponse({"success": False, "error": str(exc)}, status_code=500)


@app.get("/api/events")
def list_events(org_id: int = None, status: str = None, db: Session = Depends(get_db)):
    conditions = []
    params = {}
    if org_id:
        conditions.append("org_id = :org_id")
        params["org_id"] = org_id
    if status:
        conditions.append("status = :status")
        params["status"] = status
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    result = db.execute(text(f"""
        SELECT event_id, org_id, submitter_name, submitter_email, title, description,
               start_datetime, end_datetime, address, city, county, audience, cost,
               hyperlink, event_contact, status, admin_comment, created_at
        FROM events {where} ORDER BY created_at DESC
    """), params)
    events = [dict(row) for row in result.mappings().all()]
    for e in events:
        for key in ("start_datetime", "end_datetime", "created_at"):
            if e.get(key) and hasattr(e[key], "isoformat"):
                e[key] = e[key].isoformat()
    return JSONResponse({"success": True, "events": events})


@app.post("/api/events")
def submit_event(payload: SubmitEventRequest, db: Session = Depends(get_db)):
    if not payload.org_id and not payload.submitter_email:
        return JSONResponse(
            {"success": False, "message": "Submitter email is required for public submissions"},
            status_code=400,
        )
    try:
        result = db.execute(
            text("""
                INSERT INTO events
                  (org_id, submitted_by_user_id, submitter_name, submitter_email, submitter_phone,
                   title, description, start_datetime, end_datetime, address, city, county,
                   audience, cost, hyperlink, event_contact, status)
                VALUES
                  (:org_id, :submitted_by_user_id, :submitter_name, :submitter_email, :submitter_phone,
                   :title, :description, :start_datetime, :end_datetime, :address, :city, :county,
                   :audience, :cost, :hyperlink, :event_contact, 'pending')
                RETURNING event_id
            """),
            payload.dict()
        )
        db.commit()
        return JSONResponse({"success": True, "event_id": result.scalar()}, status_code=201)
    except Exception as e:
        db.rollback()
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)


@app.patch("/api/events/{event_id}")
def edit_event(event_id: int, payload: EditEventRequest, db: Session = Depends(get_db)):
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if not updates:
        return JSONResponse({"success": False, "message": "No fields to update"}, status_code=400)
    updates["status"] = "pending"
    updates["admin_comment"] = None
    updates["event_id"] = event_id
    set_clause = ", ".join(f"{k} = :{k}" for k in updates if k != "event_id")
    result = db.execute(
        text(f"UPDATE events SET {set_clause} WHERE event_id = :event_id RETURNING event_id"),
        updates
    )
    db.commit()
    if result.rowcount == 0:
        return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)
    return {"success": True}


@app.get("/api/invitations/validate")
def validate_invitation(token: str, db: Session = Depends(get_db)):
    row = db.execute(
        text("SELECT role, expires_at, consumed_at FROM invitations WHERE token = :token"),
        {"token": token}
    ).mappings().first()
    if not row:
        return JSONResponse({"valid": False, "message": "Invalid invitation link"}, status_code=404)
    if row["consumed_at"] is not None:
        return JSONResponse({"valid": False, "message": "This invitation has already been used"}, status_code=410)
    if row["expires_at"] < datetime.now(timezone.utc):
        return JSONResponse({"valid": False, "message": "This invitation link has expired"}, status_code=410)
    return JSONResponse({"valid": True, "role": row["role"]})


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
