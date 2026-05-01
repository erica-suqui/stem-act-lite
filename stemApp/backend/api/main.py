from datetime import datetime, timedelta, timezone
import importlib.util
import os
import secrets
import string
from enum import Enum
import bcrypt
import httpx
import logging

from fastapi import FastAPI, Depends, BackgroundTasks, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field

from .database import SessionLocal
from .email_service import send_email
try:
    from google.cloud import storage as gcs_storage
except ImportError:
    gcs_storage = None

GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "")
MULTIPART_INSTALLED = importlib.util.find_spec("multipart") is not None

logger = logging.getLogger(__name__)

app = FastAPI(
    title="STEM-ACT Backend",
    docs_url="/docs" if os.getenv("ENVIRONMENT") == "development" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT") == "development" else None,
    openapi_url="/openapi.json" if os.getenv("ENVIRONMENT") == "development" else None,
)

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

@app.middleware("http")
async def set_secure_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _geocode_event(event_id: int, address: str, city: str):
    """
    Called as a FastAPI BackgroundTask after event approval.
    Calls Nominatim to get lat/lng. Stores result in DB.
    Never raises — geocoding failure is non-fatal.
    """
    query = f"{address}, {city}, SC, USA"
    try:
        resp = httpx.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "us"},
            headers={"User-Agent": "STEM-ACT-EventMap/1.0 (stemact.org)"},
            timeout=10.0,
        )
        resp.raise_for_status()
        results = resp.json()
        if results:
            lat = float(results[0]["lat"])
            lng = float(results[0]["lon"])
            with SessionLocal() as bg_db:
                bg_db.execute(
                    text("""
                        UPDATE events
                        SET lat = :lat, lng = :lng, geocoded_at = now()
                        WHERE event_id = :event_id
                    """),
                    {"lat": lat, "lng": lng, "event_id": event_id},
                )
                bg_db.commit()
            logger.info(f"Geocoded event {event_id}: ({lat}, {lng})")
        else:
            logger.warning(f"Nominatim returned no results for event {event_id}: {query!r}")
    except Exception as exc:
        logger.error(f"Geocoding failed for event {event_id}: {exc}")


def _has_event_geocode_columns(db: Session) -> bool:
    result = db.execute(
        text(
            """
            SELECT
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'events'
                      AND column_name = 'lat'
                ) AS has_lat,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'events'
                      AND column_name = 'lng'
                ) AS has_lng,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'events'
                      AND column_name = 'geocoded_at'
                ) AS has_geocoded_at
            """
        )
    ).mappings().first()

    return bool(result and result["has_lat"] and result["has_lng"] and result["has_geocoded_at"])


def _get_event_column_flags(db: Session) -> dict:
    row = db.execute(
        text(
            """
            SELECT
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'events'
                      AND column_name = 'event_type'
                ) AS has_event_type,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'events'
                      AND column_name = 'flyer_url'
                ) AS has_flyer_url,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'events'
                      AND column_name = 'lat'
                ) AS has_lat,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'events'
                      AND column_name = 'lng'
                ) AS has_lng,
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'events'
                      AND column_name = 'geocoded_at'
                ) AS has_geocoded_at
            """
        )
    ).mappings().first()

    return {
        "event_type": bool(row and row["has_event_type"]),
        "flyer_url": bool(row and row["has_flyer_url"]),
        "lat": bool(row and row["has_lat"]),
        "lng": bool(row and row["has_lng"]),
        "geocoded_at": bool(row and row["has_geocoded_at"]),
    }


def _has_user_google_sub_column(db: Session) -> bool:
    row = db.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'users'
                  AND column_name = 'google_sub'
            ) AS has_google_sub
            """
        )
    ).mappings().first()

    return bool(row and row["has_google_sub"])


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


class PostCommentRequest(BaseModel):
    body: str = Field(min_length=1)
    author_role: str = Field(pattern="^(partner|admin)$")


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=1)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8)


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
    partnerCode: str = None


class RequestMessage(BaseModel):
    org_id: None
    message: str = Field(min_length=1)


def generate_partner_code() -> str:
    """Generate a short, hard-to-guess partner code like STEM-A3X9."""
    alphabet = string.ascii_uppercase + string.digits
    suffix = ''.join(secrets.choice(alphabet) for _ in range(4))
    return f"STEM-{suffix}"


class GeneratePartnerCodeRequest(BaseModel):
    expires_in_days: int = Field(default=7, ge=1, le=90)
    org_id: int = None


class RedeemPartnerCodeRequest(BaseModel):
    code: str
    org_id: int


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
    event_type: str = None
    tag_ids: list[int] = []


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
    event_type: str = None
    tag_ids: list[int] = None


class CreateTagRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50)


class UpdateTagRequest(BaseModel):
    is_active: bool


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
                u.email_verified,
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
    
    if not user["email_verified"] and user["role"] == UserRole.partner.value:
        return JSONResponse(
            {"success": False, "error": "Please verify your email before logging in"},
            status_code=403,
    )


    if (
        user["role"] == UserRole.partner.value
        and user["organization_status"] in {"pending", "disabled"}
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
def register(payload: RegisterRequest, background_tasks:BackgroundTasks ,db: Session = Depends(get_db)):
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

    # Validate partner code if provided
    org_status = OrganizationStatus.pending.value
    partner_code_row = None
    if payload.partnerCode:
        code = payload.partnerCode.upper().strip()
        partner_code_row = db.execute(
            text("""
                SELECT code_id, expires_at, consumed_at, org_id
                FROM partner_codes WHERE code = :code
            """),
            {"code": code},
        ).mappings().first()
        if partner_code_row is None:
            return JSONResponse({"success": False, "error": "Invalid partner code"}, status_code=400)
        if partner_code_row["consumed_at"] is not None:
            return JSONResponse({"success": False, "error": "Partner code already used"}, status_code=400)
        if partner_code_row["expires_at"] < datetime.now(timezone.utc):
            return JSONResponse({"success": False, "error": "Partner code has expired"}, status_code=400)
        org_status = OrganizationStatus.active.value

    try:
        password_hash = bcrypt.hashpw(
            payload.password.encode("utf-8"),
            bcrypt.gensalt(),
        ).decode("utf-8")
        user_name = email.split("@")[0] if "@" in email else email

        # If the partner code is linked to a pre-existing org, use it directly
        if partner_code_row and partner_code_row["org_id"]:
            org_id = partner_code_row["org_id"]
            # Update the org's contact info with this partner's details (only if not yet set)
            db.execute(
                text("""
                    UPDATE organizations
                    SET contact_first_name = :first_name,
                        contact_last_name  = :last_name,
                        contact_email      = :email,
                        contact_phone      = :phone
                    WHERE org_id = :org_id
                      AND contact_email = ''
                """),
                {
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": email,
                    "phone": phone,
                    "org_id": org_id,
                },
            )
        else:
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
                    "status": org_status,
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

        if payload.partnerCode and partner_code_row:
            db.execute(
                text("""
                    UPDATE partner_codes
                    SET consumed_at = now(), consumed_by_org_id = :org_id
                    WHERE code_id = :code_id
                """),
                {"org_id": org_id, "code_id": partner_code_row["code_id"]},
            )

        db.commit()

        token_vertify = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        db.execute(
            text( """
                    INSERT INTO email_verification_tokens(token,user_id,expires_at)
                    VALUES(:token, :user_id, :expires_at)
                """
                ), 
                {"token": token_vertify, "user_id": user_id, "expires_at": expires_at}
        )
        db.commit()

        base_url = os.getenv("APP_BASE_URL", "http://localhost:3000").rstrip('/')
        link = f"{base_url}/verify-email?token={token_vertify}"

        background_tasks.add_task(
        send_email,
        email,
         "Verify your STEM-ACT email",
         f"Please verify your email by clicking the link below. This link expires in 24 hours.\n\n{link}\n\nYour account is pending admin approval.",
        )

        return {"success": True, "user_id": user_id, "org_id": org_id}
    except Exception as exc:
        db.rollback()
        return JSONResponse({"success": False, "error": str(exc)}, status_code=500)

@app.get("/api/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    row = db.execute(
        text("SELECT user_id, expires_at, used_at FROM email_verification_tokens WHERE token = :token"),
        {"token": token}
    ).mappings().first()

    if not row:
        return JSONResponse({"valid": False, "message": "Invalid verification link"}, status_code=404)
    if row["used_at"] is not None:
        return JSONResponse({"valid": False, "message": "This link has already been used"}, status_code=410)
    if row["expires_at"] < datetime.now(timezone.utc):
        return JSONResponse({"valid": False, "message": "This verification link has expired"}, status_code=410)

    db.execute(
        text("UPDATE users SET email_verified = :email_verified WHERE user_id = :user_id"),
        {"email_verified": True, "user_id": row["user_id"]},
    )
    db.execute(
        text("UPDATE email_verification_tokens SET used_at = now() WHERE token = :token"),
        {"token": token},
    )
    db.commit()
    return JSONResponse({"valid": True, "message": "Email verified successfully"})


@app.post("/api/sendAMessage")
def sendMessage(payload:RequestMessage, background_tasks: BackgroundTasks,db: Session = Depends(get_db)):
    org = db.execute(
        text("SELECT contact_email, org_name FROM organizations WHERE org_id = :org_id"),
        {"org_id": payload.org_id}
    ).mappings().first()
    msg  = payload.message

    if org is None:
        return JSONResponse({"success": False, "error": "Organization not Found"},status_code=404)
    
    try:
        background_tasks.add_task(
        send_email,
        org["contact_email"],
        "Message from STEM-ACT Admin",
        msg)
        return JSONResponse({"success": True})
    except Exception as exc:
         return JSONResponse({"success": False, "error": str(exc)}, status_code=500)


@app.get("/api/events")
def list_events(org_id: int = None, status: str = None, db: Session = Depends(get_db)):
    column_flags = _get_event_column_flags(db)
    conditions = []
    params = {}
    if org_id:
        conditions.append("org_id = :org_id")
        params["org_id"] = org_id
    if status:
        conditions.append("status = :status")
        params["status"] = status
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    event_type_field = "event_type" if column_flags["event_type"] else "NULL::TEXT AS event_type"
    flyer_url_field = "flyer_url" if column_flags["flyer_url"] else "NULL::TEXT AS flyer_url"
    geocode_fields = (
        "lat, lng, geocoded_at"
        if column_flags["lat"] and column_flags["lng"] and column_flags["geocoded_at"]
        else "NULL::DOUBLE PRECISION AS lat, NULL::DOUBLE PRECISION AS lng, NULL::TIMESTAMPTZ AS geocoded_at"
    )
    result = db.execute(text(f"""
        SELECT
            e.event_id, e.org_id, e.submitter_name, e.submitter_email,
            e.title, e.description, e.start_datetime, e.end_datetime,
            e.address, e.city, e.county, e.audience, e.cost,
            e.hyperlink, e.event_contact, {event_type_field}, {flyer_url_field}, e.status, e.admin_comment, e.created_at,
            {geocode_fields},
            COALESCE(
                array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL),
                ARRAY[]::TEXT[]
            ) AS tag_names,
            COALESCE(
                array_agg(DISTINCT t.tag_id) FILTER (WHERE t.tag_id IS NOT NULL),
                ARRAY[]::BIGINT[]
            ) AS tag_ids
        FROM events e
        LEFT JOIN event_tags et ON et.event_id = e.event_id
        LEFT JOIN tags t ON t.tag_id = et.tag_id
        {where}
        GROUP BY e.event_id
        ORDER BY e.created_at DESC
    """), params)
    events = [dict(row) for row in result.mappings().all()]
    for e in events:
        for key in ("start_datetime", "end_datetime", "created_at"):
            if e.get(key) and hasattr(e[key], "isoformat"):
                e[key] = e[key].isoformat()
        # Convert DB arrays to plain Python lists
        e["tag_names"] = list(e.get("tag_names") or [])
        e["tag_ids"] = [int(i) for i in (e.get("tag_ids") or [])]
    return JSONResponse({"success": True, "events": events})


@app.post("/api/events")
def submit_event(payload: SubmitEventRequest, db: Session = Depends(get_db)):
    if not payload.org_id and not payload.submitter_email:
        return JSONResponse(
            {"success": False, "message": "Submitter email is required for public submissions"},
            status_code=400,
        )

    tag_ids = payload.tag_ids or []
    if len(tag_ids) > 3:
        return JSONResponse(
            {"success": False, "message": "Maximum 3 tags allowed"},
            status_code=400,
        )

    try:
        column_flags = _get_event_column_flags(db)
        columns = [
            "org_id", "submitted_by_user_id", "submitter_name", "submitter_email", "submitter_phone",
            "title", "description", "start_datetime", "end_datetime", "address", "city", "county",
            "audience", "cost", "hyperlink", "event_contact",
        ]
        values = [
            ":org_id", ":submitted_by_user_id", ":submitter_name", ":submitter_email", ":submitter_phone",
            ":title", ":description", ":start_datetime", ":end_datetime", ":address", ":city", ":county",
            ":audience", ":cost", ":hyperlink", ":event_contact",
        ]
        if column_flags["event_type"]:
            columns.append("event_type")
            values.append(":event_type")
        columns.append("status")
        values.append("'pending'")

        event_data = {k: v for k, v in payload.dict().items() if k != "tag_ids"}
        result = db.execute(
            text(f"""
                INSERT INTO events
                  ({", ".join(columns)})
                VALUES
                  ({", ".join(values)})
                RETURNING event_id
            """),
            event_data,
        )
        event_id = result.scalar()

        for tag_id in tag_ids:
            db.execute(
                text("INSERT INTO event_tags (event_id, tag_id) VALUES (:event_id, :tag_id)"),
                {"event_id": event_id, "tag_id": tag_id},
            )

        db.commit()
        return JSONResponse({"success": True, "event_id": event_id}, status_code=201)
    except Exception as e:
        db.rollback()
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)


@app.patch("/api/events/{event_id}")
def edit_event(event_id: int, payload: EditEventRequest, db: Session = Depends(get_db)):
    event = db.execute(
        text("SELECT start_datetime FROM events WHERE event_id = :event_id"),
        {"event_id": event_id},
    ).mappings().first()

    if event is None:
        return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)

    if event["start_datetime"] and event["start_datetime"] < datetime.now(timezone.utc):
        return JSONResponse({"success": False, "message": "Cannot edit a past event"}, status_code=400)

    # Validate tags if provided
    tag_ids = payload.tag_ids
    if tag_ids is not None:
        if len(tag_ids) > 3:
            return JSONResponse(
                {"success": False, "message": "Maximum 3 tags allowed"},
                status_code=400,
            )

    # Build event field updates — exclude tag_ids, it is not an events column
    column_flags = _get_event_column_flags(db)
    updates = {
        k: v for k, v in payload.dict().items()
        if v is not None and k != "tag_ids"
    }
    if not column_flags["event_type"]:
        updates.pop("event_type", None)
    if not updates and tag_ids is None:
        return JSONResponse({"success": False, "message": "No fields to update"}, status_code=400)

    try:
        if updates:
            updates["status"] = "pending"
            updates["admin_comment"] = None
            updates["event_id"] = event_id
            set_clause = ", ".join(f"{k} = :{k}" for k in updates if k != "event_id")
            result = db.execute(
                text(f"UPDATE events SET {set_clause} WHERE event_id = :event_id RETURNING event_id"),
                updates,
            )
            if result.rowcount == 0:
                db.rollback()
                return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)

        if tag_ids is not None:
            db.execute(
                text("DELETE FROM event_tags WHERE event_id = :event_id"),
                {"event_id": event_id},
            )
            for tag_id in tag_ids:
                db.execute(
                    text("INSERT INTO event_tags (event_id, tag_id) VALUES (:event_id, :tag_id)"),
                    {"event_id": event_id, "tag_id": tag_id},
                )

        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)


if MULTIPART_INSTALLED:
    @app.post("/api/events/{event_id}/flyer")
    async def upload_flyer(event_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
        if gcs_storage is None:
            return JSONResponse(
                {
                    "success": False,
                    "message": "Google Cloud Storage support is unavailable. Install google-cloud-storage to enable flyer uploads.",
                },
                status_code=503,
            )

        if not GCS_BUCKET_NAME:
            return JSONResponse(
                {
                    "success": False,
                    "message": "GCS_BUCKET_NAME is not configured.",
                },
                status_code=503,
            )

        # Verify event exists
        event = db.execute(
            text("SELECT event_id FROM events WHERE event_id = :event_id"),
            {"event_id": event_id}
        ).mappings().first()
        if not event:
            return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)

        # Validate file type
        allowed_types = {"application/pdf", "image/jpeg", "image/png"}
        if file.content_type not in allowed_types:
            return JSONResponse(
                {"success": False, "message": "Only PDF, JPG, and PNG files are allowed"},
                status_code=400
            )

        # Validate file size (10MB)
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:
            return JSONResponse({"success": False, "message": "File must be under 10MB"}, status_code=400)

        try:
            client = gcs_storage.Client()
            bucket = client.bucket(GCS_BUCKET_NAME)
            blob = bucket.blob(f"flyers/{event_id}/{file.filename}")
            blob.upload_from_string(contents, content_type=file.content_type)
            blob.make_public()
            flyer_url = blob.public_url

            if not _get_event_column_flags(db)["flyer_url"]:
                return JSONResponse(
                    {
                        "success": False,
                        "message": "Database schema does not support flyer uploads yet. Run the event_type/flyer migration first.",
                    },
                    status_code=503,
                )

            db.execute(
                text("UPDATE events SET flyer_url = :flyer_url WHERE event_id = :event_id"),
                {"flyer_url": flyer_url, "event_id": event_id}
            )
            db.commit()
            return JSONResponse({"success": True, "flyer_url": flyer_url})
        except Exception as e:
            db.rollback()
            return JSONResponse({"success": False, "message": str(e)}, status_code=500)


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
def approve_event(event_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    event_row = db.execute(
        text("SELECT address, city, title, submitter_email FROM events WHERE event_id = :event_id"),
        {"event_id": event_id},
    ).mappings().first()

    if event_row is None:
        return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)

    db.execute(
        text("""
            UPDATE events
            SET status = :status, admin_comment = NULL, reviewed_at = now()
            WHERE event_id = :event_id
        """),
        {"status": EventStatus.approved.value, "event_id": event_id},
    )
    db.commit()

    if _has_event_geocode_columns(db):
        background_tasks.add_task(
            _geocode_event, event_id, event_row["address"], event_row["city"]
        )

    if event_row["submitter_email"]:
        background_tasks.add_task(
            send_email,
            event_row["submitter_email"],
            f"Your event has been approved: {event_row['title']}",
            f"Good news! Your event \"{event_row['title']}\" has been approved and is now published on the STEM-ACT events page.",
        )

    return {"success": True}


@app.post("/api/events/{event_id}/deny")
def deny_event(event_id: int, payload: DenyEventRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not payload.comment.strip():
        return JSONResponse(
            {"success": False, "message": "Comment is required when denying an event"},
            status_code=400,
        )
    result = db.execute(
        text("""
            UPDATE events
            SET status = :status, admin_comment = :comment, reviewed_at = now()
            WHERE event_id = :event_id
            RETURNING event_id, title, submitter_email
        """),
        {"status": EventStatus.denied.value, "comment": payload.comment.strip(), "event_id": event_id},
    )
    row = result.mappings().first()
    db.commit()

    if row is None:
        return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)

    if row["submitter_email"]:
        background_tasks.add_task(
            send_email,
            row["submitter_email"],
            f"Your event was not approved: {row['title']}",
            f"Your event \"{row['title']}\" was not approved.\n\nAdmin comment: {payload.comment.strip()}\n\nYou may reply through your partner dashboard.",
        )

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


class CreateOrganizationRequest(BaseModel):
    org_name: str = Field(min_length=1)


@app.post("/api/organizations")
def create_organization(payload: CreateOrganizationRequest, db: Session = Depends(get_db)):
    existing = db.execute(
        text("SELECT org_id FROM organizations WHERE lower(org_name) = lower(:name) LIMIT 1"),
        {"name": payload.org_name.strip()},
    ).first()
    if existing is not None:
        return JSONResponse({"success": False, "error": "An organization with this name already exists"}, status_code=409)

    result = db.execute(
        text("""
            INSERT INTO organizations (org_name, contact_email, contact_phone, status)
            VALUES (:org_name, '', '', :status)
            RETURNING org_id
        """),
        {"org_name": payload.org_name.strip(), "status": OrganizationStatus.active.value},
    )
    org_id = result.scalar()
    db.commit()
    return {"success": True, "org_id": org_id, "org_name": payload.org_name.strip()}


@app.get("/api/organizations")
def list_organizations(db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT org_id, org_name, status FROM organizations ORDER BY org_name")
    ).mappings().all()
    return {"success": True, "organizations": [dict(r) for r in rows]}


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


@app.post("/api/users/{user_id}/unlink-google")
def unlink_google(user_id: int, db: Session = Depends(get_db)):
    if not _has_user_google_sub_column(db):
        return JSONResponse(
            {"success": False, "message": "Google account linking is not enabled in this database."},
            status_code=400,
        )

    target = db.execute(
        text("SELECT user_id, google_sub FROM users WHERE user_id = :user_id"),
        {"user_id": user_id},
    ).mappings().first()

    if target is None:
        return JSONResponse({"success": False, "message": "User not found"}, status_code=404)

    if target["google_sub"] is None:
        return JSONResponse({"success": False, "message": "No Google account linked"}, status_code=400)

    db.execute(
        text("UPDATE users SET google_sub = NULL WHERE user_id = :user_id"),
        {"user_id": user_id},
    )
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


@app.post("/api/partner-codes/generate")
def generate_partner_code_endpoint(
    payload: GeneratePartnerCodeRequest,
    db: Session = Depends(get_db),
):
    expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)
    # Retry up to 5 times in case of collision (extremely unlikely)
    for _ in range(5):
        code = generate_partner_code()
        existing = db.execute(
            text("SELECT code_id FROM partner_codes WHERE code = :code"),
            {"code": code},
        ).first()
        if existing is None:
            break
    else:
        return JSONResponse({"success": False, "error": "Could not generate unique code"}, status_code=500)

    db.execute(
        text("""
            INSERT INTO partner_codes (code, expires_at, org_id)
            VALUES (:code, :expires_at, :org_id)
        """),
        {"code": code, "expires_at": expires_at, "org_id": payload.org_id},
    )
    db.commit()
    return {"success": True, "code": code, "expires_at": expires_at.isoformat(), "org_id": payload.org_id}


@app.get("/api/partner-codes/validate")
def validate_partner_code(code: str, db: Session = Depends(get_db)):
    row = db.execute(
        text("""
            SELECT pc.code_id, pc.expires_at, pc.consumed_at,
                   pc.org_id, o.org_name
            FROM partner_codes pc
            LEFT JOIN organizations o ON o.org_id = pc.org_id
            WHERE pc.code = :code
        """),
        {"code": code.upper().strip()},
    ).mappings().first()

    if row is None:
        return JSONResponse({"valid": False, "message": "Invalid code"}, status_code=404)
    if row["consumed_at"] is not None:
        return JSONResponse({"valid": False, "message": "This code has already been used"}, status_code=410)
    if row["expires_at"] < datetime.now(timezone.utc):
        return JSONResponse({"valid": False, "message": "This code has expired"}, status_code=410)

    return {
        "valid": True,
        "org_id": row["org_id"],
        "org_name": row["org_name"],
    }


@app.get("/api/partner-codes")
def list_partner_codes(db: Session = Depends(get_db)):
    rows = db.execute(
        text("""
            SELECT
                pc.code_id,
                pc.code,
                pc.expires_at,
                pc.consumed_at,
                pc.created_at,
                pc.org_id,
                linked_org.org_name AS org_name,
                consumed_org.org_name AS consumed_by_org
            FROM partner_codes pc
            LEFT JOIN organizations linked_org   ON linked_org.org_id   = pc.org_id
            LEFT JOIN organizations consumed_org ON consumed_org.org_id = pc.consumed_by_org_id
            ORDER BY pc.created_at DESC
        """)
    ).mappings().all()

    codes = []
    now = datetime.now(timezone.utc)
    for r in rows:
        if r["consumed_at"] is not None:
            status = "used"
        elif r["expires_at"] < now:
            status = "expired"
        else:
            status = "active"
        codes.append({
            "code_id": r["code_id"],
            "code": r["code"],
            "expires_at": r["expires_at"].isoformat(),
            "consumed_at": r["consumed_at"].isoformat() if r["consumed_at"] else None,
            "created_at": r["created_at"].isoformat(),
            "org_id": r["org_id"],
            "org_name": r["org_name"],
            "consumed_by_org": r["consumed_by_org"],
            "status": status,
        })
    return {"success": True, "codes": codes}


@app.post("/api/partner-codes/{code_id}/revoke")
def revoke_partner_code(code_id: int, db: Session = Depends(get_db)):
    row = db.execute(
        text("SELECT code_id, consumed_at FROM partner_codes WHERE code_id = :id"),
        {"id": code_id},
    ).mappings().first()

    if row is None:
        return JSONResponse({"success": False, "message": "Code not found"}, status_code=404)
    if row["consumed_at"] is not None:
        return JSONResponse({"success": False, "message": "Code already consumed"}, status_code=400)

    db.execute(
        text("UPDATE partner_codes SET consumed_at = now() WHERE code_id = :id"),
        {"id": code_id},
    )
    db.commit()
    return {"success": True}


@app.post("/api/partner-codes/redeem")
def redeem_partner_code(payload: RedeemPartnerCodeRequest, db: Session = Depends(get_db)):
    code = payload.code.upper().strip()

    row = db.execute(
        text("""
            SELECT code_id, expires_at, consumed_at
            FROM partner_codes WHERE code = :code
        """),
        {"code": code},
    ).mappings().first()

    if row is None:
        return JSONResponse({"success": False, "error": "Invalid code"}, status_code=404)
    if row["consumed_at"] is not None:
        return JSONResponse({"success": False, "error": "This code has already been used"}, status_code=410)
    if row["expires_at"] < datetime.now(timezone.utc):
        return JSONResponse({"success": False, "error": "This code has expired"}, status_code=410)

    org = db.execute(
        text("SELECT org_id, status FROM organizations WHERE org_id = :org_id"),
        {"org_id": payload.org_id},
    ).mappings().first()

    if org is None:
        return JSONResponse({"success": False, "error": "Organization not found"}, status_code=404)
    if org["status"] == OrganizationStatus.active.value:
        return JSONResponse({"success": False, "error": "Organization is already active"}, status_code=400)

    db.execute(
        text("UPDATE organizations SET status = :status WHERE org_id = :org_id"),
        {"status": OrganizationStatus.active.value, "org_id": payload.org_id},
    )
    db.execute(
        text("""
            UPDATE partner_codes
            SET consumed_at = now(), consumed_by_org_id = :org_id
            WHERE code_id = :code_id
        """),
        {"org_id": payload.org_id, "code_id": row["code_id"]},
    )
    db.commit()
    return {"success": True}


@app.get("/api/organizations/{org_id}")
def get_organization(org_id: int, db: Session = Depends(get_db)):
    row = db.execute(
        text("""
            SELECT org_id, org_name, contact_first_name, contact_last_name,
                   contact_email, contact_phone, status
            FROM organizations
            WHERE org_id = :id
        """),
        {"id": org_id},
    ).mappings().first()
    if row is None:
        return JSONResponse({"success": False, "error": "Not found"}, status_code=404)
    return {"success": True, "organization": dict(row)}


@app.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()

    user = db.execute(
        text("SELECT user_id FROM users WHERE lower(email) = :email LIMIT 1"),
        {"email": email},
    ).mappings().first()

    # Always return success to prevent user enumeration
    if user is None:
        return {"success": True}

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    db.execute(
        text("""
            INSERT INTO password_reset_tokens (token, user_id, expires_at)
            VALUES (:token, :user_id, :expires_at)
        """),
        {"token": token, "user_id": user["user_id"], "expires_at": expires_at},
    )
    db.commit()

    base_url = os.getenv("APP_BASE_URL", "http://localhost:3000/").rstrip("/")
    reset_link = f"{base_url}/reset-password?token={token}"

    background_tasks.add_task(
        send_email,
        email,
        "Reset your STEM-ACT password",
        f"Click the link below to reset your password. This link expires in 1 hour.\n\n{reset_link}\n\nIf you did not request a password reset, you can ignore this email.",
    )

    return {"success": True}


@app.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_row = db.execute(
        text("""
            SELECT token, user_id, expires_at, used_at
            FROM password_reset_tokens
            WHERE token = :token
            LIMIT 1
        """),
        {"token": payload.token},
    ).mappings().first()

    if token_row is None:
        return JSONResponse({"success": False, "message": "Invalid or expired reset link."}, status_code=400)

    if token_row["used_at"] is not None:
        return JSONResponse({"success": False, "message": "This reset link has already been used."}, status_code=400)

    if token_row["expires_at"] < datetime.now(timezone.utc):
        return JSONResponse({"success": False, "message": "This reset link has expired."}, status_code=400)

    password_hash = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt()).decode()

    db.execute(
        text("UPDATE users SET password_hash = :hash WHERE user_id = :user_id"),
        {"hash": password_hash, "user_id": token_row["user_id"]},
    )
    db.execute(
        text("UPDATE password_reset_tokens SET used_at = now() WHERE token = :token"),
        {"token": payload.token},
    )
    db.commit()

    return {"success": True}


@app.get("/api/events/{event_id}/comments")
def get_event_comments(event_id: int, db: Session = Depends(get_db)):
    rows = db.execute(
        text("""
            SELECT comment_id, event_id, author_role, body, created_at
            FROM event_comments
            WHERE event_id = :event_id
            ORDER BY created_at ASC
        """),
        {"event_id": event_id},
    ).mappings().all()
    return {"comments": [dict(r) for r in rows]}


@app.post("/api/events/{event_id}/comments")
def post_event_comment(event_id: int, payload: PostCommentRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    event_row = db.execute(
        text("SELECT title, submitter_email FROM events WHERE event_id = :event_id"),
        {"event_id": event_id},
    ).mappings().first()

    if event_row is None:
        return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)

    db.execute(
        text("""
            INSERT INTO event_comments (event_id, author_role, body)
            VALUES (:event_id, :author_role, :body)
        """),
        {"event_id": event_id, "author_role": payload.author_role, "body": payload.body.strip()},
    )
    db.commit()

    admin_email = os.getenv("ADMIN_EMAIL", "")
    title = event_row["title"]

    if payload.author_role == "partner" and admin_email:
        background_tasks.add_task(
            send_email,
            admin_email,
            f"Partner replied on event: {title}",
            f"A partner has replied to the comment thread for event \"{title}\".\n\nMessage:\n{payload.body.strip()}\n\nView in admin dashboard.",
        )
    elif payload.author_role == "admin" and event_row["submitter_email"]:
        background_tasks.add_task(
            send_email,
            event_row["submitter_email"],
            f"Admin replied on your event: {title}",
            f"An admin has replied to your event \"{title}\".\n\nMessage:\n{payload.body.strip()}\n\nView the full thread in your partner dashboard.",
        )

    return {"success": True}


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------

@app.get("/api/tags")
def list_tags(db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT tag_id, name, slug, is_active, created_at FROM tags ORDER BY name ASC")
    ).mappings().all()
    return {"success": True, "tags": [dict(r) for r in rows]}


@app.post("/api/tags")
def create_tag(payload: CreateTagRequest, db: Session = Depends(get_db)):
    name = payload.name.strip()
    slug = name.lower().replace(" ", "-")
    try:
        result = db.execute(
            text("""
                INSERT INTO tags (name, slug)
                VALUES (:name, :slug)
                RETURNING tag_id, name, slug, is_active
            """),
            {"name": name, "slug": slug},
        )
        db.commit()
        return {"success": True, "tag": dict(result.mappings().first())}
    except Exception as e:
        db.rollback()
        return JSONResponse({"success": False, "message": str(e)}, status_code=409)


@app.patch("/api/tags/{tag_id}")
def update_tag(tag_id: int, payload: UpdateTagRequest, db: Session = Depends(get_db)):
    result = db.execute(
        text("""
            UPDATE tags SET is_active = :is_active
            WHERE tag_id = :tag_id
            RETURNING tag_id
        """),
        {"is_active": payload.is_active, "tag_id": tag_id},
    )
    db.commit()
    if result.rowcount == 0:
        return JSONResponse({"success": False, "message": "Tag not found"}, status_code=404)
    return {"success": True}


@app.get("/api/users")
def list_users(db: Session = Depends(get_db)):
    result = db.execute(
        text("""
            SELECT
                u.user_id,
                u.email,
                u.role,
                o.org_name,
                FALSE AS google_linked
            FROM users u
            LEFT JOIN organizations o ON o.org_id = u.org_id
            ORDER BY u.user_id DESC
        """)
    ).mappings().all()
    return {"success": True, "users": [dict(r) for r in result]}
