# MUI Revamp Design — STEM-ACT

**Date:** 2026-03-12
**Status:** Approved

---

## Overview

Full Material UI redesign of all pages. The existing custom CSS (`globals.css`) is replaced by a
consistent MUI theme. Two new visual contexts are introduced: a **public layout** (events listing,
submit form, register) and an **admin layout** (mini sidebar + AppBar). A brand-new public events
page replaces the old login home page.

---

## Color Theme

| Token | Value | Usage |
|---|---|---|
| primary.main | `#1565C0` | Buttons, links, sidebar active state |
| primary.dark | `#0D47A1` | AppBar background |
| primary.light | `#1976D2` | Hover states |
| background.default | `#F5F7FA` | Page background |
| background.paper | `#FFFFFF` | Cards, tables, sidebar |
| text.primary | `#1A237E` | Headings |
| text.secondary | `#546E7A` | Subtitles, meta info |

A single MUI `ThemeProvider` with `createTheme` is defined in
`app/components/theme.js` and wraps the root layout.

---

## Layout Architecture

### Public layout (no auth required)
Pages: `/`, `/login`, `/register`

- MUI `AppBar` with `#0D47A1` background
- Left: "STEM-ACT" brand text
- Right: "Submit an Event" `Button` linking to `/submit` (only — no Login link)
- No sidebar, no RouteGuard

### Admin layout (admins only)
Pages: `/superAdminDashboard`, `/partners`, `/users`

- MUI `AppBar` at top: brand + logout `IconButton`
- Persistent mini `Drawer` on the left:
  - **Collapsed** (default): icons only, `65px` wide
  - **Expanded** (on hover): icons + labels, `240px` wide, smooth transition
  - Links: Event Submissions (`DashboardIcon`), Partners (`BusinessIcon`), Users (`PeopleIcon`)
- Page content area shifts right of the drawer

### Partner layout
Pages: `/partner`

- MUI `AppBar`: brand + "My Events" label + `LogoutIcon` button
- No sidebar

### No layout
Pages: `/submit`

- No AppBar, no nav (already implemented)

---

## Page Designs

### 1. Public Events Page (`/`) — NEW

**Hero section:**
```
<h1>STEM Events in Connecticut</h1>
<p>Discover approved STEM events near you.</p>
```
Compact — max 80px tall. No image. Background `primary.dark`.

**Filter bar (below hero):**
- County `Select` (8 CT counties + "All Counties")
- Audience `Select` (unique audience values from DB + "All Audiences")
- "Clear Filters" `Button` (text variant, appears only when a filter is active)
- `aria-live="polite"` result count: "{n} events found"

**Event cards (MUI `Card` grid):**
- 3 columns desktop → 2 tablet → 1 mobile
- Per card: title (`Typography h6`), date + city/county (`Typography body2`), cost chip if present, 2-line description, "More Info" `Button` (outlined, `aria-label="More Info: {title}"`)
- If `hyperlink` is null: button is disabled with tooltip "No link provided"

**Empty state:**
```
No events found in this county. Try clearing the filters.
```

**Data source:** `GET /api/events?status=approved` — new query param to add to backend.

---

### 2. Login Page (`/login`)

- Full-viewport blue-tinted background (`primary.dark` at 10% opacity over `#F5F7FA`)
- Centered MUI `Card` (max-width 420px, `elevation={4}`)
- Card header: "STEM-ACT" logo text + "Sign In" subtitle
- MUI `TextField` for email and password
- `Button variant="contained"` full-width submit
- Link below: "New partner? Register here" → `/register`

The `LogIn` component is rewritten with MUI.

---

### 3. Register Page (`/register`)

- Same centered card layout as login, slightly taller
- MUI `TextField` for all fields (firstName, lastName, orgName, email, phone, password, confirmPassword)
- MUI `Stepper` optional — keep flat form for simplicity (YAGNI)
- The post-registration event step (already built in `RegisterForm.js`) stays, just gets MUI styling

---

### 4. Admin Dashboard (`/superAdminDashboard`)

- Page title: `Typography h4` "Event Submissions"
- Filter bar: status `ToggleButtonGroup` (All / Pending / Approved / Denied) + search `TextField`
- Events in MUI `Table` inside `Paper`:
  - Columns: Title, Organization, Date, County, Status (`Chip`), Actions
  - Status chips: pending=warning, approved=success, denied=error
  - Actions: "Approve" `Button` (success), "Deny" `Button` (error)
- Approve/Deny via MUI `Dialog` (same pattern as existing modals)

---

### 5. Partners Page (`/partners`)

- MUI `Table` in `Paper`
- Status `Chip` badges
- Approve/Deny/Revoke via MUI `Dialog`

---

### 6. Users Page (`/users`)

- MUI `Table` in `Paper`
- Role `Chip` badges (super_admin=error, admin=primary, partner=default)
- Invite link section: MUI `Card` with role `Select`, "Generate" `Button`, copyable `TextField`
- Edit role / Delete via MUI `Dialog`

---

### 7. Partner Dashboard (`/partner`) — already MUI

Apply the theme — no structural changes needed.

---

## Component Changes

| Component | Change |
|---|---|
| `app/components/theme.js` | **NEW** — MUI theme definition |
| `app/components/AdminNav.js` | Rewrite — handle public/admin/partner layout switching |
| `app/components/MiniSidebar.js` | **NEW** — hover-to-expand drawer for admin pages |
| `app/components/PublicAppBar.js` | **NEW** — AppBar for `/`, `/login`, `/register` |
| `app/components/PartnerAppBar.js` | **NEW** — AppBar for `/partner` |
| `app/components/LogIn.js` | Rewrite with MUI |
| `app/components/RegisterForm.js` | Rewrite with MUI (keep logic) |
| `app/components/EventsTable.js` | Rewrite with MUI Table |
| `app/components/OrganizationsTable.js` | Rewrite with MUI Table |
| `app/users/UsersTable.js` | Rewrite with MUI Table |
| `app/page.js` | Rewrite — public events listing |
| `app/login/page.js` | Update wrapper |
| `app/register/page.js` | Update wrapper |
| `app/globals.css` | Strip all custom classes; keep only reset + reduced-motion |

---

## Accessibility Requirements

- All `Button` components on cards use `aria-label="More Info: {event title}"`
- Filter result count uses `aria-live="polite" aria-atomic="true"`
- Mini sidebar links have `aria-label` and `aria-current="page"` on active link
- All `Dialog` components trap focus and return focus on close (MUI default behavior)
- Color-only status indicators also include text label (MUI `Chip` does this by default)
- `prefers-reduced-motion` support via `globals.css` (keep existing rule)

---

## RouteGuard & Nav Changes

`AdminNav.js` is refactored into a **layout switcher**:

```js
// Public routes — show PublicAppBar, no RouteGuard
const PUBLIC_PAGES = new Set(['/', '/login', '/register', '/submit']);

// Admin routes — show AppBar + MiniSidebar, RouteGuard (admin/super_admin)
// Partner routes — show PartnerAppBar, RouteGuard (partner)
```

The existing `RouteGuard` component stays unchanged; `AdminNav` decides which AppBar/sidebar to
render per route before delegating auth checks to RouteGuard.

---

## Backend Change Required

Add `status` filter to `GET /api/events`:

```python
@app.get("/api/events")
def list_events(org_id: int = None, status: str = None, db: Session = Depends(get_db)):
    conditions = []
    if org_id: conditions.append("org_id = :org_id")
    if status: conditions.append("status = :status")
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    ...
```

The public events page calls `GET /api/events?status=approved`.
