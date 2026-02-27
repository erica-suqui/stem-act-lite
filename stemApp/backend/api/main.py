from datetime import datetime, timedelta, timezone
import os
import secrets
from enum import Enum

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
