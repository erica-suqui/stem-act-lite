# Leaflet Map Feature — Design Document
Date: 2026-03-12

## Overview

Add an interactive Leaflet.js map to the STEM-ACT public events page, displayed as a "Map" tab alongside the existing "Cards" tab. Events are geocoded server-side at approval time and stored in the database. The map shows pins for all approved events with coordinates; events without coordinates fall back to a county centroid pin.

The app will be deployed on a subdomain (e.g. `app.stemact.org`) separate from the main WordPress site.

---

## Architecture

### Database

New migration `db/migrations/2026-03-12-geocoordinates.sql`:

```sql
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS lat  DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS lng  DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ NULL;
```

Both columns are nullable. Geocoding failure never blocks approval.

### Backend (FastAPI)

- `POST /api/events/{event_id}/approve` fires a `BackgroundTask` after committing the approval
- The background task calls Nominatim with `address + city + "SC"` and a proper `User-Agent: STEM-ACT-EventMap/1.0`
- On success: `UPDATE events SET lat=?, lng=?, geocoded_at=now() WHERE event_id=?`
- On failure (timeout, bad address, Nominatim down): silently store `NULL`, log the error
- `GET /api/events` response includes `lat` and `lng` fields
- Rate limit: approvals happen one at a time via admin action — well within Nominatim's 1 req/sec limit

If Nominatim accuracy proves insufficient for rural SC addresses, upgrade to Geocodio (2,500 free/day).

### Next.js Frontend

- `app/page.js` (server component) — passes `lat`/`lng` through to `PublicEventsClient`
- `app/components/PublicEventsClient.js` — adds Cards/Map tab switcher; existing filters apply to both tabs
- `app/components/EventsMap.js` — new client component wrapping `react-leaflet`

### County Fix (prerequisite)

Replace `CT_COUNTIES` (Connecticut, 8 counties) with all 46 South Carolina counties in:
- `app/submit/page.js`
- `app/components/EventSubmissionForm.js`
- `app/components/PublicEventsClient.js`

Update homepage text in `app/page.js` from "STEM Events in Connecticut" to "STEM Events in South Carolina".

---

## Components

### `PublicEventsClient.js` changes

Add MUI `Tabs` at the top:

```
[Cards]  [Map]
─────────────────────────────────
County: [All ▼]  Audience: [All ▼]   ← shared filters
```

- Tab state is local (`useState`)
- Both tabs receive the same filtered events array
- Map tab renders `<EventsMap events={filtered} />`

### `EventsMap.js` (new)

- `react-leaflet` `<MapContainer>` centered on South Carolina (`[33.8, -81.1]`, zoom 7)
- OpenStreetMap tiles (free, no API key)
- Two marker styles:
  - **Blue marker** — event has `lat`/`lng` from geocoding (exact address)
  - **Grey marker** — `lat`/`lng` is null, falls back to SC county centroid lookup
- `leaflet.markercluster` for clustering overlapping pins when zoomed out
- Map height: `500px` desktop / `300px` mobile (`sx={{ height: { xs: 300, md: 500 } }}`)

### Pin click popup

MUI `Popover` (or Leaflet native `Popup`) showing:
- Event title
- Date (formatted)
- City
- Address (full street address)
- "(Approximate location — pinned by county)" note for grey/centroid pins
- "More Info →" button linking to `hyperlink`

### County Centroid Fallback

Hardcoded 46-entry lookup object in `EventsMap.js`:

```js
const SC_COUNTY_CENTROIDS = {
  'Abbeville':   [34.2228, -82.3796],
  'Aiken':       [33.5438, -81.7146],
  // ... all 46 counties
};
```

Events with `lat === null` look up their `county` field in this table. If the county isn't found (data inconsistency), the event is excluded from the map entirely but remains in the card grid.

---

## Data Flow

```
Admin clicks "Approve"
  → FastAPI: UPDATE events SET status='approved'
  → BackgroundTask: Nominatim geocode(address, city, "SC")
  → On success: UPDATE events SET lat=?, lng=?, geocoded_at=now()
  → On failure: lat/lng stay NULL, approval still succeeds

Public page load (server-side)
  → fetch("/api/events?status=approved") includes lat, lng
  → events passed to PublicEventsClient as props

User clicks "Map" tab
  → EventsMap renders react-leaflet map
  → For each event:
      lat != null → blue pin at exact coordinates
      lat == null → grey pin at SC_COUNTY_CENTROIDS[event.county]
  → County/audience filters update visible pins in real time
  → Click pin → popup with event details
```

---

## Packages to Install

```bash
npm install leaflet react-leaflet leaflet.markercluster
npm install --save-dev @types/leaflet
```

Leaflet requires a CSS import. In Next.js App Router this goes in `app/layout.js`:
```js
import 'leaflet/dist/leaflet.css';
```

Leaflet's default marker icon breaks in webpack/Next.js builds — requires a one-time icon fix in `EventsMap.js` using `L.Icon.Default.mergeOptions`.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Geocoding fails at approval | `lat`/`lng` stay NULL, event still approved and published |
| Event has NULL lat/lng on map | Grey pin at county centroid |
| County not in centroid lookup | Event excluded from map only (still in card grid) |
| Nominatim down at approval time | Background task catches exception, logs error, no retry |
| No events with coordinates | Map renders empty with "No events to display" message |

---

## Deployment

- Next.js app hosted on Vercel (or VPS) at subdomain e.g. `app.stemact.org`
- WordPress main site at `stemact.org` — links to subdomain
- No iframe embedding needed
- Environment variables: `NEXT_PUBLIC_API_URL` already in use; no new env vars needed for Nominatim (no API key required)

---

## Out of Scope

- Proximity search / "events near me" (requires user location permission)
- Map on admin/partner pages
- Bulk re-geocoding of existing events (can be done via a one-off script later)
- Google Maps or paid geocoding APIs (start with Nominatim; upgrade if needed)
- Satellite/terrain tile layers
