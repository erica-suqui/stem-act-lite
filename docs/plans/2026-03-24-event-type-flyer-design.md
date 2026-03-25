# Design: Event Type & Flyer Upload

**Date:** 2026-03-24
**Status:** Approved

## Background

Stakeholder feedback identified two missing fields on events that were previously requested:
1. **Event Type** — a category for the event (e.g., Workshop, Field Trip)
2. **Flyer** — an uploadable reference document (PDF or image)

## Feature 1: Event Type

### Approach
Predefined dropdown — a fixed list of STEM-relevant categories stored as a `TEXT` column on the `events` table.

### Categories
Workshop, Field Trip, Conference, Camp, Competition, Lecture, Community Event, Other

### Changes
- **DB:** Add `event_type TEXT NULL` column to `events` table (migration script)
- **Backend:** Add `event_type: str = None` to `SubmitEventRequest` and `EditEventRequest` Pydantic models; include in INSERT and UPDATE SQL
- **Frontend:** Add `event_type` Select dropdown to `EventSubmissionForm.js` and Zod schema; display in `EventsTable.js` and public event views

## Feature 2: Flyer Upload (GCS, Backend-Mediated)

### Approach
Partner uploads a file via the event form → Next.js POSTs multipart form data to a new FastAPI endpoint → FastAPI stores the file in a GCS bucket → returns a public URL → URL saved in `flyer_url TEXT NULL` column on the `events` table.

### Storage
- Google Cloud Storage bucket
- Files stored at path: `flyers/{event_id}/{filename}`
- Public read access on stored objects

### New Endpoint
`POST /api/events/{event_id}/flyer`
- Accepts: `multipart/form-data` with a `file` field
- Accepts: PDF, PNG, JPG (max 10MB)
- Returns: `{ flyer_url: string }`

### Changes
- **Dependencies:** Add `google-cloud-storage` to `requirements.txt`; add `python-multipart` if not present
- **Env vars:** Add `GCS_BUCKET_NAME` and `GOOGLE_APPLICATION_CREDENTIALS` to backend `.env`
- **DB:** Add `flyer_url TEXT NULL` column to `events` table (same migration as event_type)
- **Backend:** Add upload endpoint; add `flyer_url` to event SELECT queries and `EditEventRequest`
- **Frontend:** Add file input to `EventSubmissionForm.js`; after event is created/saved, POST the file to the upload endpoint; display flyer link/preview in event detail views

## Migration Strategy

Single migration script (`db/migrations/001_event_type_flyer.sql`) run against the Docker DB at port 5433:

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS flyer_url TEXT NULL;
```

## Out of Scope
- Admin-managed event type list (predefined list is sufficient)
- Direct browser-to-GCS uploads (signed URLs)
- Flyer versioning / deletion cleanup
