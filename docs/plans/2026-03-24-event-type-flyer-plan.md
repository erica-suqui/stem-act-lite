# Event Type & Flyer Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an event_type dropdown and GCS-backed flyer upload to all event forms and displays.

**Architecture:** A DB migration adds two nullable columns (`event_type`, `flyer_url`) to the `events` table. The FastAPI backend gains a new `POST /api/events/{event_id}/flyer` endpoint that receives a file, uploads it to Google Cloud Storage, and stores the public URL. The `EventSubmissionForm` component collects both fields and passes the file as a second argument to `onSubmit`; each parent caller handles the file upload after the event is saved.

**Tech Stack:** Python/FastAPI (backend), google-cloud-storage, python-multipart, Next.js/React (frontend), MUI, PostgreSQL (port 5433 via Docker)

---

### Task 1: DB Migration

**Files:**
- Create: `stemApp/db/migrations/001_event_type_flyer.sql`

**Step 1: Write the migration file**

```sql
-- stemApp/db/migrations/001_event_type_flyer.sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS flyer_url  TEXT NULL;
```

**Step 2: Run it against the Docker DB (port 5433)**

```bash
psql postgresql://stemact_user:stemact_pass@127.0.0.1:5433/stemact \
  -f stemApp/db/migrations/001_event_type_flyer.sql
```

Expected output:
```
ALTER TABLE
ALTER TABLE
```

**Step 3: Verify the columns exist**

```bash
psql postgresql://stemact_user:stemact_pass@127.0.0.1:5433/stemact \
  -c "\d events" | grep -E "event_type|flyer_url"
```

Expected: two rows showing `event_type | text` and `flyer_url | text`

**Step 4: Commit**

```bash
git add stemApp/db/migrations/001_event_type_flyer.sql
git commit -m "feat: add event_type and flyer_url columns to events"
```

---

### Task 2: Backend — Event Type in Pydantic Models and Queries

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Add `event_type` to `SubmitEventRequest` (around line 250)**

Find `class SubmitEventRequest(BaseModel):` and add `event_type: str = None` after `event_contact`:

```python
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
```

**Step 2: Add `event_type` to `EditEventRequest` (around line 253)**

```python
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
```

**Step 3: Update the INSERT in `submit_event` (around line 628)**

Add `event_type` to the column list and values list:

```python
result = db.execute(
    text("""
        INSERT INTO events
          (org_id, submitted_by_user_id, submitter_name, submitter_email, submitter_phone,
           title, description, start_datetime, end_datetime, address, city, county,
           audience, cost, hyperlink, event_contact, event_type, status)
        VALUES
          (:org_id, :submitted_by_user_id, :submitter_name, :submitter_email, :submitter_phone,
           :title, :description, :start_datetime, :end_datetime, :address, :city, :county,
           :audience, :cost, :hyperlink, :event_contact, :event_type, 'pending')
        RETURNING event_id
    """),
    payload.dict()
)
```

**Step 4: Update the SELECT in `list_events` (around line 602)**

Add `event_type` and `flyer_url` to the SELECT column list:

```python
result = db.execute(text(f"""
    SELECT event_id, org_id, submitter_name, submitter_email, title, description,
           start_datetime, end_datetime, address, city, county, audience, cost,
           hyperlink, event_contact, event_type, flyer_url, status, admin_comment, created_at,
           {geocode_fields}
    FROM events {where} ORDER BY created_at DESC
"""), params)
```

**Step 5: Restart the backend to verify no import errors**

```bash
cd stemApp/backend
uvicorn api.main:app --reload --port 8000
```

Expected: starts without errors. Then in a new terminal:
```bash
curl -s http://localhost:8000/api/events | python3 -m json.tool | head -20
```
Expected: JSON with `success: true` and events list (events will have `event_type: null`, `flyer_url: null`).

**Step 6: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: add event_type to backend models and queries"
```

---

### Task 3: Backend — GCS Dependencies and Configuration

**Files:**
- Modify: `stemApp/backend/requirements.txt`
- Modify: `stemApp/backend/api/.env`

**Step 1: Add GCS dependencies to requirements.txt**

Open `stemApp/backend/requirements.txt` and add:
```
google-cloud-storage==2.18.2
python-multipart==0.0.9
```

**Step 2: Install the new dependencies**

```bash
cd stemApp/backend
source .venv/bin/activate
pip install google-cloud-storage==2.18.2 python-multipart==0.0.9
```

Expected: both packages install without error.

**Step 3: Add GCS env vars to backend .env**

Open `stemApp/backend/api/.env` and add:
```
GCS_BUCKET_NAME=your-bucket-name-here
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

> **Note for the team:** Replace `your-bucket-name-here` with the actual GCS bucket name and point `GOOGLE_APPLICATION_CREDENTIALS` to the downloaded service account JSON key file. The bucket should have uniform access control and the service account needs `roles/storage.objectAdmin`.

**Step 4: Commit**

```bash
git add stemApp/backend/requirements.txt stemApp/backend/api/.env
git commit -m "feat: add GCS dependencies and env config for flyer uploads"
```

---

### Task 4: Backend — Flyer Upload Endpoint

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Add GCS imports and client initialization at the top of main.py**

After the existing imports (around line 1–20), add:

```python
import os
from google.cloud import storage as gcs_storage
from fastapi import UploadFile, File

GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "")
```

**Step 2: Add the flyer upload endpoint after the `edit_event` route (around line 674)**

```python
@app.post("/api/events/{event_id}/flyer")
async def upload_flyer(event_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
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

        db.execute(
            text("UPDATE events SET flyer_url = :flyer_url WHERE event_id = :event_id"),
            {"flyer_url": flyer_url, "event_id": event_id}
        )
        db.commit()
        return JSONResponse({"success": True, "flyer_url": flyer_url})
    except Exception as e:
        db.rollback()
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)
```

**Step 3: Restart backend and verify the endpoint exists**

```bash
curl -s http://localhost:8000/openapi.json | python3 -c \
  "import sys,json; routes=json.load(sys.stdin)['paths']; print([r for r in routes if 'flyer' in r])"
```

Expected: `['/api/events/{event_id}/flyer']`

**Step 4: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: add GCS flyer upload endpoint POST /api/events/{event_id}/flyer"
```

---

### Task 5: Frontend — EventSubmissionForm (Event Type + Flyer Input)

**Files:**
- Modify: `stemApp/app/components/EventSubmissionForm.js`

**Step 1: Add event type constants and update the schema/empty form**

At the top of the file, after `CT_COUNTIES`, add:

```js
const EVENT_TYPES = [
  'Workshop',
  'Field Trip',
  'Conference',
  'Camp',
  'Competition',
  'Lecture',
  'Community Event',
  'Other',
];
```

Add `event_type` to `eventSchema`:
```js
event_type: z.string().optional(),
```

Add `event_type: ''` and `flyerFile: null` to `EMPTY_FORM`:
```js
const EMPTY_FORM = {
  title: '',
  description: '',
  start_datetime: '',
  end_datetime: '',
  address: '',
  city: '',
  county: '',
  audience: '',
  cost: '',
  hyperlink: '',
  event_contact: '',
  event_type: '',
};
```

**Step 2: Add flyerFile state**

Inside the component, add:
```js
const [flyerFile, setFlyerFile] = useState(null);
```

**Step 3: Update handleSubmit to pass flyerFile as second argument**

Change the `onSubmit` call:
```js
const response = await onSubmit(result.data, flyerFile);
```

**Step 4: Add the event_type Select and flyer file input to the JSX**

After the `event_contact` TextField and before the button row, add:

```jsx
<FormControl fullWidth>
  <InputLabel id="event-type-label">Event Type</InputLabel>
  <Select
    labelId="event-type-label"
    id="event-type-select"
    name="event_type"
    value={formData.event_type}
    label="Event Type"
    onChange={handleChange}
  >
    <MenuItem value="">— Select a type —</MenuItem>
    {EVENT_TYPES.map((type) => (
      <MenuItem key={type} value={type}>{type}</MenuItem>
    ))}
  </Select>
</FormControl>

<Box>
  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
    Flyer (PDF, JPG, or PNG — max 10MB)
  </Typography>
  <input
    type="file"
    accept=".pdf,.jpg,.jpeg,.png"
    onChange={(e) => setFlyerFile(e.target.files?.[0] || null)}
  />
  {flyerFile && (
    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
      Selected: {flyerFile.name}
    </Typography>
  )}
</Box>
```

**Step 5: Commit**

```bash
git add stemApp/app/components/EventSubmissionForm.js
git commit -m "feat: add event_type dropdown and flyer file input to EventSubmissionForm"
```

---

### Task 6: Frontend — Partner Page (handle flyerFile in submit/edit)

**Files:**
- Modify: `stemApp/app/partner/page.js`

**Step 1: Update `handleSubmitNew` to accept and upload flyerFile**

Replace the existing `handleSubmitNew` function:

```js
const handleSubmitNew = async (formData, flyerFile) => {
  if (!orgId || !userId) {
    addToast('Session expired. Please log in again.', 'error');
    return { success: false, message: 'Not authenticated' };
  }
  try {
    const res = await fetch(apiUrl('/api/events'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        org_id: Number(orgId),
        submitted_by_user_id: Number(userId),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      addToast(err.detail || 'Failed to submit event.', 'error');
      return { success: false, message: err.detail || 'Failed to submit event.' };
    }
    const data = await res.json();
    if (flyerFile && data.event_id) {
      const form = new FormData();
      form.append('file', flyerFile);
      await fetch(apiUrl(`/api/events/${data.event_id}/flyer`), {
        method: 'POST',
        body: form,
      });
    }
    addToast('Event submitted successfully!', 'success');
    setSubmitOpen(false);
    fetchEvents();
    return { success: true };
  } catch (err) {
    addToast('An unexpected error occurred.', 'error');
    return { success: false, message: 'An unexpected error occurred.' };
  }
};
```

**Step 2: Update `handleEditSubmit` to accept and upload flyerFile**

Replace the existing `handleEditSubmit` function:

```js
const handleEditSubmit = async (formData, flyerFile) => {
  if (!editEvent) return;
  try {
    const res = await fetch(apiUrl(`/api/events/${editEvent.event_id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      addToast(err.detail || 'Failed to update event.', 'error');
      return { success: false, message: err.detail || 'Failed to update event.' };
    }
    if (flyerFile) {
      const form = new FormData();
      form.append('file', flyerFile);
      await fetch(apiUrl(`/api/events/${editEvent.event_id}/flyer`), {
        method: 'POST',
        body: form,
      });
    }
    addToast('Event updated successfully!', 'success');
    setEditEvent(null);
    fetchEvents();
    return { success: true };
  } catch (err) {
    addToast('An unexpected error occurred.', 'error');
    return { success: false, message: 'An unexpected error occurred.' };
  }
};
```

**Step 3: Commit**

```bash
git add stemApp/app/partner/page.js
git commit -m "feat: handle flyerFile upload in partner submit and edit flows"
```

---

### Task 7: Frontend — EventsTable (admin side: flyerFile + display)

**Files:**
- Modify: `stemApp/app/components/EventsTable.js`

**Step 1: Update `handleAdminAddEvent` to accept and upload flyerFile**

Replace the existing `handleAdminAddEvent`:

```js
const handleAdminAddEvent = useCallback(async (formData, flyerFile) => {
  try {
    const submitRes = await fetch(apiUrl('/api/events'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, submitter_name: 'Admin', submitter_email: 'admin' }),
    });
    const submitData = await submitRes.json();
    if (!submitData.success) return { success: false, message: submitData.message };

    const eventId = submitData.event_id;

    if (flyerFile) {
      const form = new FormData();
      form.append('file', flyerFile);
      await fetch(apiUrl(`/api/events/${eventId}/flyer`), { method: 'POST', body: form });
    }

    const approveRes = await fetch(apiUrl(`/api/events/${eventId}/approve`), { method: 'POST' });
    const approveData = await approveRes.json();
    if (!approveData.success) return { success: false, message: 'Event created but approval failed.' };

    setEvents(prev => [{
      event_id: eventId,
      ...formData,
      org_id: null,
      submitter_name: 'Admin',
      status: 'approved',
      admin_comment: null,
      created_at: new Date().toISOString(),
      tag_names: [],
    }, ...prev]);
    setAddEventOpen(false);
    addToast(`"${formData.title}" created and published.`, 'success');
    return { success: true };
  } catch {
    return { success: false, message: 'Network error. Please try again.' };
  }
}, [addToast]);
```

**Step 2: Add `event_type` to the table header**

In the `TableHead` row, find the column header array and add `'TYPE'`:
```js
{['EVENT', 'TYPE', 'DATE & TIME', 'LOCATION', 'AUDIENCE', 'COST', 'SUBMITTED', 'ACTIONS'].map(h => (
```

**Step 3: Add a `TYPE` cell in each `TableRow` (after the EVENT cell)**

After the `{/* EVENT */}` `TableCell`, add:
```jsx
{/* TYPE */}
<TableCell>
  <Typography variant="body2">{event.event_type || '—'}</Typography>
</TableCell>
```

Also update `colSpan={7}` to `colSpan={8}` in both expanded row `TableCell` elements.

**Step 4: Add flyer link to the expanded detail panel**

In the expanded detail `Box`, after the description block, add:
```jsx
{event.flyer_url && (
  <>
    <Typography variant="subtitle2" fontWeight={600} gutterBottom>Flyer</Typography>
    <Typography variant="body2">
      <a href={event.flyer_url} target="_blank" rel="noopener noreferrer">
        View Flyer
      </a>
    </Typography>
  </>
)}
```

**Step 5: Commit**

```bash
git add stemApp/app/components/EventsTable.js
git commit -m "feat: add event_type column and flyer link to admin EventsTable"
```

---

### Task 8: Frontend — Public Events Display (event_type chip + flyer link)

**Files:**
- Modify: `stemApp/app/components/PublicEventsClient.js`

**Step 1: Add event_type chip to public event cards**

In the `CardContent`, after the cost `Chip`, add:
```jsx
{event.event_type && (
  <Chip label={event.event_type} size="small" variant="outlined" sx={{ mb: 1, ml: event.cost ? 1 : 0 }} />
)}
```

**Step 2: Add event_type and flyer to the More Info dialog**

In the `DialogContent`, after the audience line, add:
```jsx
{selectedEvent?.event_type && (
  <Typography variant="body2"><strong>Type:</strong> {selectedEvent.event_type}</Typography>
)}
{selectedEvent?.flyer_url && (
  <Typography variant="body2">
    <strong>Flyer:</strong>{' '}
    <a href={selectedEvent.flyer_url} target="_blank" rel="noopener noreferrer">
      View Flyer
    </a>
  </Typography>
)}
```

**Step 3: Commit**

```bash
git add stemApp/app/components/PublicEventsClient.js
git commit -m "feat: show event_type and flyer link on public event cards and detail dialog"
```

---

## Post-Implementation Checklist

- [ ] GCS bucket created and credentials file placed at path in `.env`
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` and `GCS_BUCKET_NAME` set correctly
- [ ] Partner can submit an event with event_type and flyer
- [ ] Flyer URL appears in the admin expanded detail
- [ ] Flyer link appears in the public More Info dialog
- [ ] Event type chip visible on public cards
- [ ] Event type column visible in admin EventsTable
