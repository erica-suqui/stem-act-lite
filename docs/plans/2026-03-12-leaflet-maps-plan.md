# Leaflet Map Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Cards / Map" tab to the public events page that shows approved events as Leaflet pins, geocoded server-side at approval time and stored in the database.

**Architecture:** Admin approves an event → FastAPI fires a background task that calls Nominatim and stores lat/lng in the DB. The public page reads pre-computed coordinates; events without coordinates fall back to a South Carolina county centroid. A new `EventsMap.js` component renders the map; `PublicEventsClient.js` gets a tab switcher.

**Tech Stack:** FastAPI (Python), `httpx` (async HTTP for geocoding), `react-leaflet` + `leaflet` + `leaflet.markercluster` (map), MUI v7 Tabs (tab switcher), PostgreSQL (stores lat/lng).

---

## Task 1: Fix South Carolina county data (prerequisite)

All three files below hardcode Connecticut counties (`CT_COUNTIES`). The homepage also says "Connecticut". Fix these first — everything else depends on correct county data.

**Files:**
- Modify: `stemApp/app/components/PublicEventsClient.js:9`
- Modify: `stemApp/app/submit/page.js:21-30`
- Modify: `stemApp/app/components/EventSubmissionForm.js:20-28`
- Modify: `stemApp/app/page.js:22` (homepage heading)
- Modify: `stemApp/app/layout.js:7` (metadata description)

**Step 1: Replace CT_COUNTIES with SC_COUNTIES in all three component files**

Replace the `CT_COUNTIES` array in each file with:

```js
const SC_COUNTIES = [
  'Abbeville','Aiken','Allendale','Anderson','Bamberg','Barnwell','Beaufort',
  'Berkeley','Calhoun','Charleston','Cherokee','Chester','Chesterfield',
  'Clarendon','Colleton','Darlington','Dillon','Dorchester','Edgefield',
  'Fairfield','Florence','Georgetown','Greenville','Greenwood','Hampton',
  'Horry','Jasper','Kershaw','Lancaster','Laurens','Lee','Lexington',
  'Marion','Marlboro','McCormick','Newberry','Oconee','Orangeburg',
  'Pickens','Richland','Saluda','Spartanburg','Sumter','Union',
  'Williamsburg','York',
];
```

Also rename all uses of `CT_COUNTIES` to `SC_COUNTIES` in the same file.

**Step 2: Update homepage heading in `app/page.js`**

Change:
```jsx
STEM Events in Connecticut
```
To:
```jsx
STEM Events in South Carolina
```

**Step 3: Update layout metadata in `app/layout.js`**

Change:
```js
description: 'STEM events across Connecticut',
```
To:
```js
description: 'STEM events across South Carolina',
```

**Step 4: Verify visually**

Start the dev server (`npm run dev` from `stemApp/`). Open http://localhost:3000. Confirm:
- The county dropdown shows 46 SC counties (Abbeville through York)
- The hero heading says "STEM Events in South Carolina"

**Step 5: Commit**

```bash
git add stemApp/app/components/PublicEventsClient.js \
        stemApp/app/submit/page.js \
        stemApp/app/components/EventSubmissionForm.js \
        stemApp/app/page.js \
        stemApp/app/layout.js
git commit -m "fix: replace CT counties with SC counties, update state references"
```

---

## Task 2: DB migration — add geocoordinate columns

**Files:**
- Create: `stemApp/db/migrations/2026-03-12-geocoordinates.sql`

**Step 1: Create the migration file**

```sql
-- 2026-03-12-geocoordinates.sql
-- Add geocoordinate columns to events table for Leaflet map pins.
-- Both columns are nullable — geocoding failure never blocks event approval.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS lat          DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS lng          DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS geocoded_at  TIMESTAMPTZ NULL;
```

**Step 2: Run the migration**

```bash
psql -U stemact -d stemact -f stemApp/db/migrations/2026-03-12-geocoordinates.sql
```

Expected output:
```
ALTER TABLE
```

**Step 3: Verify columns exist**

```bash
psql -U stemact -d stemact -c "\d events" | grep -E "lat|lng|geocoded"
```

Expected output (3 lines):
```
 lat          | double precision |
 lng          | double precision |
 geocoded_at  | timestamp with time zone |
```

**Step 4: Commit**

```bash
git add stemApp/db/migrations/2026-03-12-geocoordinates.sql
git commit -m "feat: add lat/lng/geocoded_at columns to events table"
```

---

## Task 3: Update FastAPI `GET /api/events` to return lat/lng

**Files:**
- Modify: `stemApp/backend/api/main.py:354-358`

**Step 1: Add lat/lng to the SELECT**

Find the `list_events` function (around line 343). The current SELECT is:

```python
result = db.execute(text(f"""
    SELECT event_id, org_id, submitter_name, submitter_email, title, description,
           start_datetime, end_datetime, address, city, county, audience, cost,
           hyperlink, event_contact, status, admin_comment, created_at
    FROM events {where} ORDER BY created_at DESC
"""), params)
```

Change to:

```python
result = db.execute(text(f"""
    SELECT event_id, org_id, submitter_name, submitter_email, title, description,
           start_datetime, end_datetime, address, city, county, audience, cost,
           hyperlink, event_contact, status, admin_comment, created_at,
           lat, lng, geocoded_at
    FROM events {where} ORDER BY created_at DESC
"""), params)
```

**Step 2: Verify the API returns lat/lng**

Start the FastAPI server:
```bash
cd stemApp/backend && python3 -m uvicorn api.main:app --reload
```

Hit the events endpoint:
```bash
curl -s "http://localhost:8000/api/events?status=approved" | python3 -m json.tool | grep -E '"lat"|"lng"'
```

Expected: Each event object now includes `"lat": null` and `"lng": null` (null until geocoding runs).

**Step 3: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: include lat/lng/geocoded_at in GET /api/events response"
```

---

## Task 4: Add geocoding background task to approve endpoint

**Files:**
- Modify: `stemApp/backend/api/main.py`

**Step 1: Install httpx in the backend venv**

```bash
cd stemApp/backend && .venv/bin/pip install httpx
```

**Step 2: Add the geocoding helper function**

At the top of `main.py`, after the existing imports, add:

```python
import httpx
import logging

logger = logging.getLogger(__name__)

def _geocode_event(event_id: int, address: str, city: str):
    """
    Called as a FastAPI BackgroundTask after event approval.
    Calls Nominatim to get lat/lng for the event address.
    Stores result in DB. Never raises — geocoding failure is non-fatal.
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
            # Use a fresh DB connection (background tasks run outside request context)
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
```

Note: `SessionLocal` is already used in the file via `get_db` — check the import at the top of `main.py`. If it's not imported directly, find how the session is created and use the same pattern.

**Step 3: Update `approve_event` to fire the background task**

Change the function signature and body from:

```python
@app.post("/api/events/{event_id}/approve")
def approve_event(event_id: int, db: Session = Depends(get_db)):
    result = db.execute(
        text("""
            UPDATE events
            SET status = :status, admin_comment = NULL, reviewed_at = now()
            WHERE event_id = :event_id
            RETURNING event_id
        """),
        {"status": EventStatus.approved.value, "event_id": event_id},
    )
    row = result.first()
    db.commit()

    if row is None:
        return JSONResponse({"success": False, "message": "Event not found"}, status_code=404)

    return {"success": True}
```

To:

```python
@app.post("/api/events/{event_id}/approve")
def approve_event(event_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Fetch address fields before approving (needed for geocoding)
    event_row = db.execute(
        text("SELECT address, city FROM events WHERE event_id = :event_id"),
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

    # Geocode asynchronously — never blocks or fails the approval
    background_tasks.add_task(
        _geocode_event, event_id, event_row["address"], event_row["city"]
    )

    return {"success": True}
```

Also add `BackgroundTasks` to the FastAPI imports at the top of `main.py`. It's already in `fastapi`:
```python
from fastapi import FastAPI, Depends, BackgroundTasks
```

**Step 4: Check SessionLocal is accessible**

The `_geocode_event` function uses `SessionLocal` directly (not via `Depends`). Find where the engine/session is created in `main.py` (search for `SessionLocal` or `sessionmaker`). It should be at the top. If it's in a separate `database.py` file, import it:

```python
from .database import SessionLocal
```

**Step 5: Test the geocoding flow**

1. Make sure FastAPI is running: `cd stemApp/backend && python3 -m uvicorn api.main:app --reload`
2. Approve an event that has a real SC address via the admin UI or curl:
   ```bash
   curl -s -X POST "http://localhost:8000/api/events/1/approve"
   ```
3. Wait 2-3 seconds (background task runs after the response)
4. Check that lat/lng were stored:
   ```bash
   psql -U stemact -d stemact -c "SELECT event_id, lat, lng, geocoded_at FROM events WHERE event_id = 1;"
   ```
   Expected: `lat` and `lng` are not null, `geocoded_at` has a timestamp.

5. Check the FastAPI logs for a line like:
   ```
   INFO: Geocoded event 1: (34.xxx, -82.xxx)
   ```

**Step 6: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: geocode events via Nominatim background task on approval"
```

---

## Task 5: Install Leaflet packages and add CSS

**Files:**
- Modify: `stemApp/package.json` (via npm install)
- Modify: `stemApp/app/layout.js`

**Step 1: Install packages**

```bash
cd stemApp && npm install leaflet react-leaflet leaflet.markercluster
npm install --save-dev @types/leaflet
```

Expected: packages appear in `node_modules/`, `package.json` updated.

**Step 2: Add Leaflet CSS to the layout**

In `stemApp/app/layout.js`, add the import at the top:

```js
import 'leaflet/dist/leaflet.css';
```

The file currently looks like:
```js
import './globals.css';
import AdminNav from './components/AdminNav';
import ThemeRegistry from './components/ThemeRegistry';
```

Add it as the third line (after globals.css):
```js
import './globals.css';
import 'leaflet/dist/leaflet.css';
import AdminNav from './components/AdminNav';
import ThemeRegistry from './components/ThemeRegistry';
```

**Step 3: Verify no CSS errors**

Start the dev server: `npm run dev` from `stemApp/`. Open http://localhost:3000. No CSS-related errors should appear in the terminal or browser console.

**Step 4: Commit**

```bash
git add stemApp/package.json stemApp/package-lock.json stemApp/app/layout.js
git commit -m "feat: install react-leaflet and add Leaflet CSS to layout"
```

---

## Task 6: Create EventsMap component

**Files:**
- Create: `stemApp/app/components/EventsMap.js`

**Step 1: Create the component**

Create `stemApp/app/components/EventsMap.js` with the following content:

```js
'use client';

import { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import MarkerClusterGroup from 'react-leaflet-markercluster';

// Fix Leaflet's broken default icon in Next.js / webpack builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Grey icon for county-centroid fallback pins
const greyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// SC county geographic centroids — used as fallback when lat/lng is null
const SC_COUNTY_CENTROIDS = {
  'Abbeville':   [34.2228, -82.3796],
  'Aiken':       [33.5438, -81.7146],
  'Allendale':   [32.9860, -81.3879],
  'Anderson':    [34.5254, -82.6449],
  'Bamberg':     [33.2176, -81.0649],
  'Barnwell':    [33.2576, -81.3987],
  'Beaufort':    [32.3532, -80.6600],
  'Berkeley':    [33.1985, -79.9571],
  'Calhoun':     [33.6726, -80.7862],
  'Charleston':  [32.7765, -79.9311],
  'Cherokee':    [35.0460, -81.6218],
  'Chester':     [34.6818, -81.1546],
  'Chesterfield':[34.6368, -80.0754],
  'Clarendon':   [33.6576, -80.2157],
  'Colleton':    [32.9371, -80.7187],
  'Darlington':  [34.3196, -79.9754],
  'Dillon':      [34.4046, -79.3682],
  'Dorchester':  [33.1090, -80.4076],
  'Edgefield':   [33.7626, -81.9690],
  'Fairfield':   [34.3810, -81.1240],
  'Florence':    [34.0360, -79.7668],
  'Georgetown':  [33.5435, -79.2897],
  'Greenville':  [34.8526, -82.3940],
  'Greenwood':   [34.1818, -82.1160],
  'Hampton':     [32.8676, -81.1282],
  'Horry':       [33.9271, -78.9882],
  'Jasper':      [32.5296, -81.0768],
  'Kershaw':     [34.3382, -80.5793],
  'Lancaster':   [34.6860, -80.7079],
  'Laurens':     [34.4893, -82.0132],
  'Lee':         [34.1601, -80.2568],
  'Lexington':   [33.8935, -81.2418],
  'Marion':      [34.1710, -79.4207],
  'Marlboro':    [34.6201, -79.6621],
  'McCormick':   [33.9026, -82.3068],
  'Newberry':    [34.2810, -81.6076],
  'Oconee':      [34.7601, -83.0632],
  'Orangeburg':  [33.4485, -80.8179],
  'Pickens':     [34.8832, -82.7182],
  'Richland':    [34.0007, -80.9009],
  'Saluda':      [34.0035, -81.7454],
  'Spartanburg': [34.9496, -81.9320],
  'Sumter':      [33.9185, -80.3762],
  'Union':       [34.7082, -81.6240],
  'Williamsburg':[33.6243, -79.8279],
  'York':        [34.9965, -81.2418],
};

function formatDate(iso) {
  if (!iso) return 'Date TBD';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EventsMap({ events }) {
  const mappable = events.filter(e => {
    if (e.lat != null && e.lng != null) return true;
    return e.county in SC_COUNTY_CENTROIDS;
  });

  if (mappable.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="text.secondary">No events to display on the map.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: { xs: 300, md: 500 }, width: '100%', borderRadius: 1, overflow: 'hidden' }}>
      <MapContainer
        center={[33.8, -81.1]}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup>
          {mappable.map(event => {
            const isExact = event.lat != null && event.lng != null;
            const position = isExact
              ? [event.lat, event.lng]
              : SC_COUNTY_CENTROIDS[event.county];
            const icon = isExact ? undefined : greyIcon;

            return (
              <Marker key={event.event_id} position={position} icon={icon}>
                <Popup>
                  <strong>{event.title}</strong>
                  <br />
                  {formatDate(event.start_datetime)} &middot; {event.city}
                  <br />
                  {event.address}
                  {!isExact && (
                    <>
                      <br />
                      <em style={{ fontSize: '0.8em', color: '#666' }}>
                        Approximate location — pinned by county
                      </em>
                    </>
                  )}
                  {event.hyperlink && (
                    <>
                      <br />
                      <a href={event.hyperlink} target="_blank" rel="noopener noreferrer">
                        More Info →
                      </a>
                    </>
                  )}
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </Box>
  );
}
```

**Step 2: Check if react-leaflet-markercluster is the right package name**

Run:
```bash
ls stemApp/node_modules | grep marker
```

If `react-leaflet-markercluster` is not there (it may be named differently), install it:
```bash
cd stemApp && npm install react-leaflet-markercluster
```

If the package has compatibility issues with the installed react-leaflet version, use the built-in Leaflet `markercluster` plugin directly via a `useEffect` hook instead. In that case, simplify `EventsMap.js` by removing the `MarkerClusterGroup` import and wrapping individual `<Marker>` components directly inside `<MapContainer>` without clustering for now.

**Step 3: Verify map renders**

The map can't be verified in isolation without the tab switcher (Task 7). Skip to Task 7, then verify both together.

**Step 4: Commit**

```bash
git add stemApp/app/components/EventsMap.js
git commit -m "feat: add EventsMap component with SC county centroid fallback"
```

---

## Task 7: Add Cards/Map tab switcher to PublicEventsClient

**Files:**
- Modify: `stemApp/app/components/PublicEventsClient.js`

**Step 1: Add Tabs import and tab state**

At the top of `PublicEventsClient.js`, add `Tabs` and `Tab` to the MUI imports:

```js
import {
  Box, Grid, Card, CardContent, CardActions, Typography,
  Button, Select, MenuItem, FormControl, InputLabel, Chip, Stack,
  Tabs, Tab,
} from '@mui/material';
```

Add a dynamic import for EventsMap (prevents SSR issues with Leaflet):

```js
import dynamic from 'next/dynamic';
const EventsMap = dynamic(() => import('./EventsMap'), { ssr: false });
```

**Step 2: Add tab state inside the component**

Inside `PublicEventsClient`, add after the existing `useState` calls:

```js
const [tab, setTab] = useState(0); // 0 = Cards, 1 = Map
```

**Step 3: Add the tab switcher UI**

Replace the opening `<>` with `<Box>` and add the Tabs component before the filters Stack:

```jsx
return (
  <Box>
    <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
      <Tab label="Cards" />
      <Tab label="Map" />
    </Tabs>

    {/* existing filters Stack */}
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" mb={3}>
      {/* ... all existing filter JSX unchanged ... */}
    </Stack>

    {tab === 0 && (
      /* existing card grid JSX — move everything from filtered.length === 0 check
         down to the closing Grid tag here, unchanged */
    )}

    {tab === 1 && (
      <EventsMap events={filtered} />
    )}
  </Box>
);
```

Replace the closing `</>` with `</Box>`.

**Step 4: Verify the tab switcher works**

1. Start the dev server: `npm run dev` from `stemApp/`
2. Open http://localhost:3000
3. Confirm:
   - "Cards" and "Map" tabs appear above the filters
   - Clicking "Cards" shows the event card grid
   - Clicking "Map" shows the Leaflet map centered on South Carolina
   - County/audience filters update both views
   - Clicking a map pin shows a popup with event title, date, address, and "More Info" link
   - Events without lat/lng show a grey pin with "Approximate location" note

**Step 5: Commit**

```bash
git add stemApp/app/components/PublicEventsClient.js
git commit -m "feat: add Cards/Map tab switcher to public events page"
```

---

## Task 8: End-to-end verification

**Step 1: Test the full geocoding flow**

1. Start both servers:
   - FastAPI: `cd stemApp/backend && python3 -m uvicorn api.main:app --reload`
   - Next.js: `cd stemApp && npm run dev`

2. Log in as admin (http://localhost:3000/login)

3. Submit a test event with a real SC address (e.g. "1600 Gervais St, Columbia, Richland") via http://localhost:3000/submit

4. Approve the event in the admin dashboard

5. Wait 3 seconds, then check the DB:
   ```bash
   psql -U stemact -d stemact -c \
     "SELECT title, lat, lng, geocoded_at FROM events WHERE status='approved' ORDER BY reviewed_at DESC LIMIT 1;"
   ```
   Expected: lat/lng populated, geocoded_at is not null.

6. Go to http://localhost:3000, click the "Map" tab. Confirm a blue pin appears at approximately the correct location in South Carolina.

7. Click the pin. Confirm the popup shows the event title, date, address, and "More Info" link.

**Step 2: Test the fallback**

1. Manually set lat/lng to NULL for a test event:
   ```bash
   psql -U stemact -d stemact -c \
     "UPDATE events SET lat=NULL, lng=NULL WHERE event_id=<id>;"
   ```

2. Reload http://localhost:3000, click "Map". Confirm a grey pin appears at the county centroid for that event's county.

3. Click the grey pin. Confirm the "Approximate location" note appears in the popup.

**Step 3: Commit (if any fixes were needed)**

```bash
git add -p   # stage only intentional changes
git commit -m "fix: end-to-end verification fixes"
```

---

## Notes for the implementer

**Leaflet + Next.js SSR:** Leaflet uses `window` internally. The `dynamic(() => import('./EventsMap'), { ssr: false })` in `PublicEventsClient.js` prevents server-side rendering of the map component. Do not remove `ssr: false` — it will cause a build error.

**markercluster compatibility:** `react-leaflet-markercluster` may have peer dependency issues depending on the exact `react-leaflet` version installed. If it fails to install or import, remove the `MarkerClusterGroup` wrapper and render `<Marker>` components directly. Clustering is a nice-to-have, not required for the feature to work.

**SessionLocal in background task:** The `_geocode_event` function uses `SessionLocal` directly (not via `Depends`). This is intentional — background tasks run outside the FastAPI request lifecycle and cannot use dependency injection. Ensure `SessionLocal` is accessible at module scope in `main.py`.

**Nominatim rate limit:** 1 request per second. Approvals are one-at-a-time admin actions, so this is never a concern in normal use. Do not add parallel batch geocoding without implementing a throttle.

**Existing events:** Events approved before this feature was deployed will have `lat = NULL`. They will show as county-centroid pins on the map. A future one-off script can back-fill coordinates for existing events.
