# Phase 3: Submission System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the trusted partner event submission system — including a partner dashboard, standalone event submission form, optional event submission during registration, and a public-facing event submission form for unauthenticated public users.

**Architecture:** New API endpoints handle event CRUD for partners; a new `/partner` Next.js route hosts the partner dashboard showing submitted events and their statuses; `RegisterForm.js` gains an optional second step that collects one or more events.

**Tech Stack:** Next.js 14 (App Router), FastAPI/Python, PostgreSQL, Zod (validation), existing `useToast` hook, existing component patterns.

---

## Context: What Exists Already

- **`stemApp/`** — the Next.js + FastAPI app (this is the working directory for all tasks)
- **Backend:** `backend/api/main.py` — FastAPI app; already has approve/deny/revoke endpoints but **no event submission or listing endpoints**
- **DB schema:** `db/` — events table exists with all needed columns
- **Auth:** JWT stored in `localStorage` as `token`; decoded to get `role`, `user_id`, `org_id`
- **Existing components:** `EventsTable.js`, `Toast.js`, `Modal.js`, `NavLinks.js`, `RouteGuard.js`
- **`lib/api.js`** — exports `apiUrl()` helper

## What Phase 3 Needs to Build

1. **Backend:** GET `/api/events` — list events (admin sees all; partner sees own org's)
2. **Backend:** POST `/api/events` — partner submits a new event
3. **Backend:** PATCH `/api/events/{id}` — partner edits a pending/denied event (triggers re-approval)
4. **Partner Dashboard** (`/partner`) — shows partner's events with status badges and edit capability
5. **Event Submission Form** component — reusable form for submitting/editing an event
6. **Registration update** — after org registration success, ask "Add an event now?" with multi-event support
7. **Nav update** — partners redirected to `/partner` after login
8. **Public Submission Form** (`/submit`) — unauthenticated public users can submit events with additional required fields (submitter name, email, phone); goes through same pending → approval workflow

---

## Task 1: Backend — GET /api/events endpoint

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Add the endpoint after the existing `/api/register` endpoint (around line 244)**

```python
@app.get("/api/events")
def list_events(org_id: int = None, db: Session = Depends(get_db)):
    where = "WHERE org_id = :org_id" if org_id else ""
    result = db.execute(
        text(f"""
            SELECT event_id, org_id, submitter_name, submitter_email, title, description,
                   start_datetime, end_datetime, address, city, county, audience, cost,
                   hyperlink, event_contact, status, admin_comment, created_at
            FROM events
            {where}
            ORDER BY created_at DESC
        """),
        {"org_id": org_id} if org_id else {}
    )
    events = [dict(row) for row in result.mappings().all()]
    for e in events:
        for key in ("start_datetime", "end_datetime", "created_at"):
            if e.get(key) and hasattr(e[key], "isoformat"):
                e[key] = e[key].isoformat()
    return JSONResponse({"success": True, "events": events})
```

**Step 2: Test manually**

```bash
curl http://localhost:8000/api/events
# Expected: {"success": true, "events": [...]}

curl http://localhost:8000/api/events?org_id=1
# Expected: {"success": true, "events": [...only org 1 events...]}
```

**Step 3: Commit**

```bash
cd stemApp
git add backend/api/main.py
git commit -m "feat: add GET /api/events endpoint with optional org_id filter"
```

---

## Task 2: Backend — POST /api/events endpoint

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Add request model** (add near the other Pydantic models at top of file, around line 80)

```python
class SubmitEventRequest(BaseModel):
    org_id: int
    submitted_by_user_id: int
    title: str
    description: str
    start_datetime: str   # ISO string, e.g. "2026-04-01T10:00:00"
    end_datetime: str = None
    address: str
    city: str
    county: str
    audience: str = None
    cost: str = None
    hyperlink: str = None
    event_contact: str = None
```

**Step 2: Add the endpoint**

```python
@app.post("/api/events")
def submit_event(payload: SubmitEventRequest, db: Session = Depends(get_db)):
    try:
        result = db.execute(
            text("""
                INSERT INTO events
                  (org_id, submitted_by_user_id, title, description,
                   start_datetime, end_datetime, address, city, county,
                   audience, cost, hyperlink, event_contact, status)
                VALUES
                  (:org_id, :submitted_by_user_id, :title, :description,
                   :start_datetime, :end_datetime, :address, :city, :county,
                   :audience, :cost, :hyperlink, :event_contact, 'pending')
                RETURNING event_id
            """),
            payload.dict()
        )
        db.commit()
        event_id = result.scalar()
        return JSONResponse({"success": True, "event_id": event_id}, status_code=201)
    except Exception as e:
        db.rollback()
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)
```

**Step 3: Test manually**

```bash
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{"org_id":1,"submitted_by_user_id":1,"title":"Test Event","description":"A test","start_datetime":"2026-04-01T10:00:00","address":"123 Main St","city":"Hartford","county":"Hartford"}'
# Expected: {"success": true, "event_id": <number>}
```

**Step 4: Commit**

```bash
git add backend/api/main.py
git commit -m "feat: add POST /api/events endpoint for event submission"
```

---

## Task 3: Backend — PATCH /api/events/{id} endpoint

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Add request model**

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
```

**Step 2: Add endpoint** (partners can only edit their own pending/denied events; editing resets status to pending)

```python
@app.patch("/api/events/{event_id}")
def edit_event(event_id: int, payload: EditEventRequest, db: Session = Depends(get_db)):
    # Build dynamic SET clause from provided (non-None) fields
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if not updates:
        return JSONResponse({"success": False, "message": "No fields to update"}, status_code=400)

    # Always reset to pending on edit
    updates["status"] = "pending"
    updates["admin_comment"] = None
    updates["event_id"] = event_id

    set_clause = ", ".join(f"{k} = :{k}" for k in updates if k != "event_id")
    result = db.execute(
        text(f"""
            UPDATE events
            SET {set_clause}
            WHERE event_id = :event_id
            RETURNING event_id
        """),
        updates
    )
    db.commit()
    if result.rowcount == 0:
        return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)
    return JSONResponse({"success": True})
```

**Step 3: Test manually**

```bash
curl -X PATCH http://localhost:8000/api/events/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title"}'
# Expected: {"success": true}
```

**Step 4: Commit**

```bash
git add backend/api/main.py
git commit -m "feat: add PATCH /api/events/{id} for partner event editing"
```

---

## Task 4: Event Submission Form Component

This is the reusable form used both in the partner dashboard (standalone submission) and during registration.

**Files:**
- Create: `stemApp/app/components/EventSubmissionForm.js`

**Step 1: Create the component**

```jsx
'use client';
import React, { useState } from 'react';
import * as z from 'zod';

const CT_COUNTIES = [
  'Fairfield', 'Hartford', 'Litchfield', 'Middlesex',
  'New Haven', 'New London', 'Tolland', 'Windham'
];

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  start_datetime: z.string().min(1, 'Start date/time is required'),
  end_datetime: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  county: z.string().min(1, 'County is required'),
  audience: z.string().optional(),
  cost: z.string().optional(),
  hyperlink: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  event_contact: z.string().email('Must be a valid email').optional().or(z.literal('')),
});

const EMPTY_EVENT = {
  title: '', description: '', start_datetime: '', end_datetime: '',
  address: '', city: '', county: '', audience: '', cost: '',
  hyperlink: '', event_contact: '',
};

/**
 * EventSubmissionForm
 * Props:
 *   initialData  - optional object to pre-fill (for editing)
 *   onSubmit     - async fn(eventData) called with validated data; should return {success, message?}
 *   submitLabel  - button label, defaults to "Submit Event"
 *   onCancel     - optional fn(), shows a Cancel button if provided
 */
export default function EventSubmissionForm({ initialData, onSubmit, submitLabel = 'Submit Event', onCancel }) {
  const [formData, setFormData] = useState({ ...EMPTY_EVENT, ...initialData });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const result = eventSchema.safeParse(formData);
    if (!result.success) {
      setErrors(result.error.format());
      return;
    }
    setSubmitting(true);
    try {
      const res = await onSubmit(formData);
      if (!res.success) setServerError(res.message || 'Submission failed');
    } catch (err) {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const field = (label, name, type = 'text', required = false) => (
    <div className="form-field">
      <label>{label}{required && ' *'}</label>
      <input type={type} name={name} value={formData[name]} onChange={handleChange} />
      {errors[name] && <span className="field-error">{errors[name]._errors[0]}</span>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="event-submission-form">
      {field('Event Title', 'title', 'text', true)}
      <div className="form-field">
        <label>Description *</label>
        <textarea name="description" value={formData.description} onChange={handleChange} rows={4} />
        {errors.description && <span className="field-error">{errors.description._errors[0]}</span>}
      </div>
      {field('Start Date & Time', 'start_datetime', 'datetime-local', true)}
      {field('End Date & Time', 'end_datetime', 'datetime-local')}
      {field('Address', 'address', 'text', true)}
      {field('City', 'city', 'text', true)}
      <div className="form-field">
        <label>County *</label>
        <select name="county" value={formData.county} onChange={handleChange}>
          <option value="">Select a county</option>
          {CT_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {errors.county && <span className="field-error">{errors.county._errors[0]}</span>}
      </div>
      {field('Target Audience', 'audience')}
      {field('Cost (e.g. "Free" or "$10")', 'cost')}
      {field('Event URL / Registration Link', 'hyperlink', 'url')}
      {field('Event Contact Email', 'event_contact', 'email')}
      {serverError && <p className="server-error">{serverError}</p>}
      <div className="form-actions">
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
        <button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : submitLabel}</button>
      </div>
    </form>
  );
}
```

**Step 2: Commit**

```bash
git add app/components/EventSubmissionForm.js
git commit -m "feat: add reusable EventSubmissionForm component"
```

---

## Task 5: Partner Dashboard Page

**Files:**
- Create: `stemApp/app/partner/page.js`

**Step 1: Understand what this page needs**

- Show the logged-in partner's submitted events in a table
- Each row shows: title, status badge (color-coded), start date, admin comment (if denied)
- "Submit New Event" button opens a modal with EventSubmissionForm
- "Edit" button on pending/denied events opens modal pre-filled with that event's data
- Uses `RouteGuard` to restrict to `partner` role only
- Reads `org_id` and `user_id` from localStorage JWT

**Step 2: Create the page**

```jsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import RouteGuard from '../components/RouteGuard';
import EventSubmissionForm from '../components/EventSubmissionForm';
import { useToast } from '@/hooks/useToast';
import { apiUrl } from '@/lib/api';

const STATUS_COLORS = {
  pending: '#f59e0b',
  approved: '#10b981',
  denied: '#ef4444',
};

function getUser() {
  if (typeof window === 'undefined') return {};
  try {
    const token = localStorage.getItem('token');
    if (!token) return {};
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch { return {}; }
}

export default function PartnerDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const { showToast, ToastContainer } = useToast();
  const user = getUser();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/events?org_id=${user.org_id}`));
      const data = await res.json();
      if (data.success) setEvents(data.events);
    } finally {
      setLoading(false);
    }
  }, [user.org_id]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleSubmit = async (formData) => {
    const res = await fetch(apiUrl('/api/events'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        org_id: user.org_id,
        submitted_by_user_id: user.user_id,
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('Event submitted successfully!', 'success');
      setShowForm(false);
      fetchEvents();
    }
    return data;
  };

  const handleEdit = async (formData) => {
    const res = await fetch(apiUrl(`/api/events/${editingEvent.event_id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (data.success) {
      showToast('Event updated and resubmitted for approval.', 'success');
      setEditingEvent(null);
      fetchEvents();
    }
    return data;
  };

  const canEdit = (status) => status === 'pending' || status === 'denied';

  return (
    <RouteGuard allowedRoles={['partner']}>
      <div className="partner-dashboard">
        <ToastContainer />
        <div className="dashboard-header">
          <h2>My Events</h2>
          <button onClick={() => setShowForm(true)}>+ Submit New Event</button>
        </div>

        {loading ? (
          <p>Loading events...</p>
        ) : events.length === 0 ? (
          <p>No events submitted yet.</p>
        ) : (
          <table className="events-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Start Date</th>
                <th>Status</th>
                <th>Admin Comment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.event_id}>
                  <td>{ev.title}</td>
                  <td>{new Date(ev.start_datetime).toLocaleDateString()}</td>
                  <td>
                    <span style={{
                      color: STATUS_COLORS[ev.status] || '#6b7280',
                      fontWeight: 'bold',
                      textTransform: 'capitalize',
                    }}>
                      {ev.status}
                    </span>
                  </td>
                  <td>{ev.admin_comment || '—'}</td>
                  <td>
                    {canEdit(ev.status) && (
                      <button onClick={() => setEditingEvent(ev)}>Edit</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showForm && (
          <div className="modal-overlay">
            <div className="modal-box" style={{ maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
              <h3>Submit New Event</h3>
              <EventSubmissionForm
                onSubmit={handleSubmit}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        )}

        {editingEvent && (
          <div className="modal-overlay">
            <div className="modal-box" style={{ maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
              <h3>Edit Event</h3>
              <EventSubmissionForm
                initialData={editingEvent}
                onSubmit={handleEdit}
                submitLabel="Save & Resubmit"
                onCancel={() => setEditingEvent(null)}
              />
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
```

**Step 3: Commit**

```bash
git add app/partner/page.js
git commit -m "feat: add partner dashboard with event list, submit, and edit"
```

---

## Task 6: Update Login Redirect for Partners

**Files:**
- Read first: `stemApp/app/components/LogIn.js`
- Modify: `stemApp/app/components/LogIn.js`

**Step 1: Find the role-based redirect block after successful login**

Look for `router.push(...)` calls. The decoded JWT will have a `role` field.

**Step 2: Add partner redirect**

```js
if (role === 'partner') router.push('/partner');
```

**Step 3: Commit**

```bash
git add app/components/LogIn.js
git commit -m "feat: redirect partners to /partner dashboard after login"
```

---

## Task 7: Update NavLinks for Partner Role

**Files:**
- Read first: `stemApp/app/components/NavLinks.js`
- Modify: `stemApp/app/components/NavLinks.js`

**Step 1: Read the file — understand how nav links are conditionally shown by role**

**Step 2: Add partner nav link**

Partners should see "My Events" → `/partner`. Do not show admin links to partners.

**Step 3: Commit**

```bash
git add app/components/NavLinks.js
git commit -m "feat: add partner nav links for dashboard"
```

---

## Task 8: Update Registration — Optional Event Step

**Files:**
- Modify: `stemApp/app/components/RegisterForm.js`

**Step 1: Add new state variables**

```js
const [registered, setRegistered] = useState(false);
const [addingEvents, setAddingEvents] = useState(false);
const [events, setEvents] = useState([]);
const [registeredUser, setRegisteredUser] = useState(null); // {org_id, user_id}
```

**Step 2: On registration success, save user info and show prompt**

In `handleFormSubmit`, when `data.success` is true:
- Save `{ org_id: data.org_id, user_id: data.user_id }` to `registeredUser`
- Set `registered = true` (instead of the old modal + redirect)

**Step 3: Render the "add event?" prompt**

```jsx
if (registered && !addingEvents) {
  return (
    <div className="register-event-prompt">
      <h3>Registration successful!</h3>
      <p>Would you like to add an event now?</p>
      <button onClick={() => setAddingEvents(true)}>Yes, add an event</button>
      <button onClick={() => navigate.push('/partner')}>No, go to dashboard</button>
    </div>
  );
}
```

**Step 4: Render the event submission flow**

```jsx
if (addingEvents) {
  const handleEventSubmit = async (formData) => {
    const res = await fetch(apiUrl('/api/events'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        org_id: registeredUser.org_id,
        submitted_by_user_id: registeredUser.user_id,
      }),
    });
    const data = await res.json();
    if (data.success) setEvents(prev => [...prev, formData]);
    return data;
  };

  return (
    <div className="register-event-step">
      <h3>Add Event(s)</h3>
      {events.length > 0 && <p>{events.length} event(s) added.</p>}
      <EventSubmissionForm onSubmit={handleEventSubmit} submitLabel="Add Event" />
      {events.length > 0 && (
        <button onClick={() => navigate.push('/partner')}>Done — Go to Dashboard</button>
      )}
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add app/components/RegisterForm.js
git commit -m "feat: add optional event submission step to registration flow"
```

---

## Task 9: Update /api/register to Return org_id and user_id

**Files:**
- Modify: `stemApp/backend/api/main.py` (around line 163)

**Step 1: Read the register endpoint — find what it currently returns**

**Step 2: Update the return value to include org_id and user_id**

```python
return JSONResponse({
    "success": True,
    "user_id": user_id,
    "org_id": org_id,
})
```

**Step 3: Test**

```bash
curl -X POST http://localhost:8000/api/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@test.com","password":"TestPass1","confirmPassword":"TestPass1","orgName":"Test Org","phone":"1234567890"}'
# Expected: {"success": true, "user_id": <n>, "org_id": <n>}
```

**Step 4: Commit**

```bash
git add backend/api/main.py
git commit -m "fix: return org_id and user_id from /api/register for event step"
```

---

## Task 10: Public Event Submission Form (`/submit`)

Public (unauthenticated) users can submit events without an account. Because they have no org or user ID, the form collects submitter contact info. The submission goes through the same pending → approval workflow.

**Files:**
- Create: `stemApp/app/submit/page.js`
- Modify: `stemApp/backend/api/main.py` — update POST `/api/events` to accept submissions without `org_id`/`submitted_by_user_id`

**Step 1: Update POST /api/events to allow public submissions**

In `main.py`, change `SubmitEventRequest` so `org_id` and `submitted_by_user_id` are optional, and `submitter_name`, `submitter_email`, `submitter_phone` are required for public users:

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
```

Add validation in the endpoint before the INSERT:

```python
@app.post("/api/events")
def submit_event(payload: SubmitEventRequest, db: Session = Depends(get_db)):
    # Public submission requires contact info
    if not payload.org_id and not payload.submitter_email:
        return JSONResponse(
            {"success": False, "message": "Submitter email is required for public submissions"},
            status_code=400
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
        event_id = result.scalar()
        return JSONResponse({"success": True, "event_id": event_id}, status_code=201)
    except Exception as e:
        db.rollback()
        return JSONResponse({"success": False, "message": str(e)}, status_code=500)
```

**Step 2: Create the public submission page**

```jsx
'use client';
import { useState } from 'react';
import * as z from 'zod';
import { apiUrl } from '@/lib/api';

const CT_COUNTIES = [
  'Fairfield', 'Hartford', 'Litchfield', 'Middlesex',
  'New Haven', 'New London', 'Tolland', 'Windham'
];

const publicSchema = z.object({
  submitter_name: z.string().min(1, 'Your name is required'),
  submitter_email: z.string().email('A valid email is required'),
  submitter_phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits (no dashes)'),
  title: z.string().min(1, 'Event title is required'),
  description: z.string().min(1, 'Description is required'),
  start_datetime: z.string().min(1, 'Start date/time is required'),
  end_datetime: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  county: z.string().min(1, 'County is required'),
  audience: z.string().optional(),
  cost: z.string().optional(),
  hyperlink: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  event_contact: z.string().email('Must be a valid email').optional().or(z.literal('')),
});

const EMPTY = {
  submitter_name: '', submitter_email: '', submitter_phone: '',
  title: '', description: '', start_datetime: '', end_datetime: '',
  address: '', city: '', county: '', audience: '', cost: '',
  hyperlink: '', event_contact: '',
};

export default function PublicSubmitPage() {
  const [formData, setFormData] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const result = publicSchema.safeParse(formData);
    if (!result.success) {
      setErrors(result.error.format());
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/events'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setServerError(data.message || 'Submission failed. Please try again.');
      }
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const field = (label, name, type = 'text', required = false) => (
    <div className="form-field">
      <label>{label}{required && ' *'}</label>
      <input type={type} name={name} value={formData[name]} onChange={handleChange} />
      {errors[name] && <span className="field-error">{errors[name]._errors[0]}</span>}
    </div>
  );

  if (submitted) {
    return (
      <main className="submit-container">
        <h2>Thank you!</h2>
        <p>Your event has been submitted and is pending review. You will be contacted at <strong>{formData.submitter_email}</strong> once a decision has been made.</p>
      </main>
    );
  }

  return (
    <main className="submit-container">
      <h2>Submit a STEM Event</h2>
      <p>Fill out the form below to submit your event for review. All submissions are reviewed before being published.</p>

      <form onSubmit={handleSubmit} className="event-submission-form">
        <h3>Your Contact Information</h3>
        {field('Your Name', 'submitter_name', 'text', true)}
        {field('Your Email', 'submitter_email', 'email', true)}
        {field('Your Phone', 'submitter_phone', 'tel', true)}

        <h3>Event Details</h3>
        {field('Event Title', 'title', 'text', true)}
        <div className="form-field">
          <label>Description *</label>
          <textarea name="description" value={formData.description} onChange={handleChange} rows={4} />
          {errors.description && <span className="field-error">{errors.description._errors[0]}</span>}
        </div>
        {field('Start Date & Time', 'start_datetime', 'datetime-local', true)}
        {field('End Date & Time', 'end_datetime', 'datetime-local')}
        {field('Address', 'address', 'text', true)}
        {field('City', 'city', 'text', true)}
        <div className="form-field">
          <label>County *</label>
          <select name="county" value={formData.county} onChange={handleChange}>
            <option value="">Select a county</option>
            {CT_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.county && <span className="field-error">{errors.county._errors[0]}</span>}
        </div>
        {field('Target Audience', 'audience')}
        {field('Cost (e.g. "Free" or "$10")', 'cost')}
        {field('Event URL / Registration Link', 'hyperlink', 'url')}
        {field('Event Contact Email', 'event_contact', 'email')}

        {serverError && <p className="server-error">{serverError}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Event'}
        </button>
      </form>
    </main>
  );
}
```

**Step 3: Test manually**

```bash
# Public submission (no org_id)
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "submitter_name":"Jane Public","submitter_email":"jane@example.com","submitter_phone":"8605551234",
    "title":"Public STEM Event","description":"Open to all","start_datetime":"2026-05-01T09:00:00",
    "address":"1 Science Way","city":"New Haven","county":"New Haven"
  }'
# Expected: {"success": true, "event_id": <n>}
```

1. Go to `http://localhost:3000/submit`
2. Fill in contact info + event details → submit
3. See confirmation message with email address
4. Log in as admin → verify the event appears in the events table with `pending` status and submitter info visible

**Step 4: Commit**

```bash
git add app/submit/page.js backend/api/main.py
git commit -m "feat: add public event submission page at /submit"
```

---

## Task 11: Smoke Test Full Flow

**Step 1: Start the app**

```bash
# Terminal 1 — backend
cd stemApp/backend && uvicorn api.main:app --reload

# Terminal 2 — frontend
cd stemApp && npm run dev
```

**Step 2: Test partner registration + event submission**

1. Go to `http://localhost:3000/register`
2. Fill in org/user details → submit
3. See "Would you like to add an event?" prompt
4. Click "Yes" → fill event form → submit
5. See "1 event added" → click "Done"
6. Verify redirect to `/partner` dashboard
7. Verify event appears with `pending` status

**Step 3: Test login redirect**

1. Log in as a partner
2. Verify redirect to `/partner` (not admin dashboard)

**Step 4: Test event editing**

1. On partner dashboard, click "Edit" on a `pending` or `denied` event
2. Modify a field → "Save & Resubmit"
3. Verify event status resets to `pending` and updated data shows

**Step 5: Test public submission form**

1. Go to `http://localhost:3000/submit` (no login)
2. Fill in contact info + event details → submit
3. See confirmation message with the submitter's email
4. Log in as admin → verify the event appears in the events table with `pending` status and submitter name/email visible

**Step 6: Test admin still sees all events**

1. Log in as admin
2. Check that the existing Events table shows events from both partners and public users

**Step 7: Commit any fixes**

```bash
git add -p
git commit -m "fix: <description of fix>"
```

---

## Task 12: Partner Invite Link

**What exists already:**
- `POST /api/users/invite` — generates a token, stores it in the `invitations` table, returns a link like `/register?token=<token>&role=admin`
- `invitations` table has `token`, `role`, `expires_at`, `consumed_at` columns
- `InviteRole` enum only allows `super_admin` and `admin` — **partner is missing**
- `RegisterForm.js` does not read the `?token` query param
- No `GET /api/invitations/validate` endpoint to verify a token before showing the form
- No UI in the admin dashboard for generating a partner invite link

**What we need to build:**
1. Extend `InviteRole` to include `partner`
2. Add `GET /api/invitations/validate?token=...` endpoint
3. Update `RegisterForm.js` to read the token from the URL and wire it through registration
4. Update `POST /api/register` to consume the token on success
5. Add "Generate Partner Invite" button to the admin dashboard

---

### Task 12a: Extend InviteRole to include partner

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Add `partner` to the `InviteRole` enum (around line 75)**

```python
class InviteRole(str, Enum):
    super_admin = "super_admin"
    admin = "admin"
    partner = "partner"
```

Also update the `invitations` table CHECK constraint in the DB schema to allow `partner`. Open `stemApp/db/schema.sql` and find:

```sql
role TEXT NOT NULL CHECK (role IN ('super_admin','admin')),
```

Change to:

```sql
role TEXT NOT NULL CHECK (role IN ('super_admin','admin','partner')),
```

> **Note:** If the database is already running, run this migration directly:
> ```sql
> ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
> ALTER TABLE invitations ADD CONSTRAINT invitations_role_check
>   CHECK (role IN ('super_admin','admin','partner'));
> ```

**Step 2: Commit**

```bash
git add backend/api/main.py db/schema.sql
git commit -m "feat: allow partner role in invitation system"
```

---

### Task 12b: Add GET /api/invitations/validate endpoint

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Add the endpoint**

```python
@app.get("/api/invitations/validate")
def validate_invitation(token: str, db: Session = Depends(get_db)):
    result = db.execute(
        text("""
            SELECT role, expires_at, consumed_at
            FROM invitations
            WHERE token = :token
        """),
        {"token": token}
    )
    row = result.mappings().first()
    if not row:
        return JSONResponse({"valid": False, "message": "Invalid invitation link"}, status_code=404)
    if row["consumed_at"] is not None:
        return JSONResponse({"valid": False, "message": "This invitation has already been used"}, status_code=410)
    if row["expires_at"] < datetime.now(timezone.utc):
        return JSONResponse({"valid": False, "message": "This invitation link has expired"}, status_code=410)
    return JSONResponse({"valid": True, "role": row["role"]})
```

**Step 2: Test manually**

```bash
# First generate an invite to get a token
curl -X POST http://localhost:8000/api/users/invite \
  -H "Content-Type: application/json" \
  -d '{"role": "partner"}'
# Copy the token from the inviteLink in the response

curl "http://localhost:8000/api/invitations/validate?token=<copied-token>"
# Expected: {"valid": true, "role": "partner"}
```

**Step 3: Commit**

```bash
git add backend/api/main.py
git commit -m "feat: add GET /api/invitations/validate endpoint"
```

---

### Task 12c: Update RegisterForm to read invite token from URL

When a partner clicks their invite link (`/register?token=abc123&role=partner`), the form should:
- Validate the token on mount (call `/api/invitations/validate`)
- Show an error if the token is invalid/expired
- Hide the password-setting step until the token is confirmed valid
- Pass the token along with the registration payload

**Files:**
- Modify: `stemApp/app/components/RegisterForm.js`

**Step 1: Read the token from query params on mount**

Add at the top of the component (after existing state declarations):

```js
import { useSearchParams } from 'next/navigation';

// Inside the component:
const searchParams = useSearchParams();
const inviteToken = searchParams.get('token');
const inviteRole = searchParams.get('role');

const [tokenValid, setTokenValid] = useState(null); // null=checking, true=valid, false=invalid
const [tokenError, setTokenError] = useState('');

useEffect(() => {
  if (!inviteToken) {
    setTokenValid(true); // no token = normal public registration (or partner self-register)
    return;
  }
  fetch(apiUrl(`/api/invitations/validate?token=${inviteToken}`))
    .then(r => r.json())
    .then(data => {
      if (data.valid) {
        setTokenValid(true);
      } else {
        setTokenValid(false);
        setTokenError(data.message || 'Invalid invitation link');
      }
    })
    .catch(() => {
      setTokenValid(false);
      setTokenError('Could not verify invitation. Please try again.');
    });
}, [inviteToken]);
```

**Step 2: Show a loading/error state while token is being checked**

At the top of the return statement, before the form:

```jsx
if (inviteToken && tokenValid === null) {
  return <p>Verifying your invitation...</p>;
}
if (inviteToken && tokenValid === false) {
  return (
    <div className="invite-error">
      <h3>Invitation Error</h3>
      <p>{tokenError}</p>
    </div>
  );
}
```

**Step 3: Include the token in the registration payload**

In `handleFormSubmit`, add `inviteToken` to the JSON body:

```js
body: JSON.stringify({ ...formData, inviteToken: inviteToken || null })
```

**Step 4: Commit**

```bash
git add app/components/RegisterForm.js
git commit -m "feat: validate and pass invite token through registration form"
```

---

### Task 12d: Consume token on successful registration

**Files:**
- Modify: `stemApp/backend/api/main.py` (the `/api/register` endpoint, around line 163)

**Step 1: Update the register endpoint to accept and consume the token**

Add `invite_token: str = None` to the registration request model (find the model used by `/api/register` and add the field):

```python
# Add to the registration request model:
inviteToken: str = None
```

In the register endpoint body, after successfully creating the user, consume the token:

```python
if payload.inviteToken:
    db.execute(
        text("""
            UPDATE invitations
            SET consumed_at = now()
            WHERE token = :token AND consumed_at IS NULL
        """),
        {"token": payload.inviteToken}
    )
    # (db.commit() already called below)
```

**Step 2: Test end-to-end**

```bash
# 1. Generate a partner invite
curl -X POST http://localhost:8000/api/users/invite \
  -H "Content-Type: application/json" \
  -d '{"role": "partner"}'
# Note the inviteLink

# 2. Open inviteLink in browser — should show registration form without error

# 3. Register — should succeed

# 4. Try using the same link again — should show "already been used" error
```

**Step 3: Commit**

```bash
git add backend/api/main.py
git commit -m "feat: consume invite token on successful registration"
```

---

### Task 12e: Add "Generate Partner Invite" UI in admin dashboard

Admins need a way to generate an invite link and copy it to share with a partner.

**Files:**
- Read first: the admin dashboard page (likely `stemApp/app/users/page.js` or `stemApp/app/superAdminDashboard/page.js`)
- Modify: whichever page manages users/partners

**Step 1: Read the admin dashboard to find where user management lives**

Look for existing "Invite User" functionality. It may already exist for admin role invites.

**Step 2: Add a "Generate Partner Invite Link" button**

If no invite UI exists yet, add a button that:
1. Calls `POST /api/users/invite` with `{"role": "partner"}`
2. Shows the returned `inviteLink` in a copyable text box

```jsx
const [partnerInviteLink, setPartnerInviteLink] = useState('');
const [generating, setGenerating] = useState(false);

const generatePartnerInvite = async () => {
  setGenerating(true);
  try {
    const res = await fetch(apiUrl('/api/users/invite'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'partner' }),
    });
    const data = await res.json();
    if (data.success) setPartnerInviteLink(data.inviteLink);
  } finally {
    setGenerating(false);
  }
};

// In JSX:
<div className="invite-section">
  <button onClick={generatePartnerInvite} disabled={generating}>
    {generating ? 'Generating...' : 'Generate Partner Invite Link'}
  </button>
  {partnerInviteLink && (
    <div className="invite-link-box">
      <input type="text" readOnly value={partnerInviteLink} />
      <button onClick={() => navigator.clipboard.writeText(partnerInviteLink)}>
        Copy
      </button>
      <p><em>This link expires in 48 hours.</em></p>
    </div>
  )}
</div>
```

**Step 3: Commit**

```bash
git add app/users/page.js  # or whichever file was modified
git commit -m "feat: add generate partner invite link UI in admin dashboard"
```

---

## Summary: Files Changed

| File | Change |
|------|--------|
| `backend/api/main.py` | + GET /api/events, POST /api/events (with public support), PATCH /api/events/{id}, update /api/register response; extend InviteRole to partner; add GET /api/invitations/validate; consume token on register |
| `db/schema.sql` | Extend invitations role CHECK constraint to include partner |
| `app/components/EventSubmissionForm.js` | New reusable event form component (used by partners) |
| `app/partner/page.js` | New partner dashboard page |
| `app/submit/page.js` | New public event submission page (no login required) |
| `app/components/LogIn.js` | Add partner redirect |
| `app/components/NavLinks.js` | Add partner nav links |
| `app/components/RegisterForm.js` | Read + validate invite token from URL; pass token to register API |
| `app/users/page.js` (or superAdminDashboard) | Add "Generate Partner Invite Link" button |
