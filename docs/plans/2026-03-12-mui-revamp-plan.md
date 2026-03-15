# MUI Revamp Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign all pages to use MUI with a blue/white theme, a hover-to-expand mini sidebar for admins, a public events listing page at `/`, and a clean public layout for login/register.

**Architecture:** A single MUI `ThemeProvider` wraps the app. `AdminNav.js` acts as a layout switcher — public routes get a simple `PublicAppBar`, admin routes get `AppBar + MiniSidebar`, partner routes get `PartnerAppBar`. All custom CSS classes are replaced by MUI `sx` props or component styles.

**Tech Stack:** Next.js 14 App Router, MUI v6 (`@mui/material`, `@mui/icons-material`), React 18, FastAPI backend.

---

## Pre-flight: Read These First

Before any task, read the design doc:
`docs/plans/2026-03-12-mui-revamp-design.md`

Key paths in `stemApp/`:
- `app/layout.js` — root layout (wraps everything in `AdminNav`)
- `app/components/AdminNav.js` — layout switcher (currently just hides nav on `/submit`)
- `app/components/RouteGuard.js` — auth redirect logic (do not change)
- `app/globals.css` — 855 lines of custom CSS to eventually strip
- `lib/api.js` — `apiUrl()` helper → `http://localhost:8000`
- `lib/utils.js` — `formatDate`, `formatCost`, `formatTimeRange`, `formatFullName`

All work is in branch `submissionPage`. All commands run from `stemApp/`.

---

## Task 1: MUI Theme

**Files:**
- Create: `app/components/theme.js`
- Modify: `app/layout.js`

**Step 1: Create the theme file**

```js
// app/components/theme.js
'use client';
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1565C0',
      dark: '#0D47A1',
      light: '#1976D2',
    },
    background: {
      default: '#F5F7FA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A237E',
      secondary: '#546E7A',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h4: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 8 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
  },
});

export default theme;
```

**Step 2: Create a ThemeRegistry client component**

MUI requires `ThemeProvider` in a client component. Create:

```js
// app/components/ThemeRegistry.js
'use client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';

export default function ThemeRegistry({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
```

**Step 3: Wrap root layout**

Read `app/layout.js` first, then update it:

```js
import './globals.css';
import AdminNav from './components/AdminNav';
import ThemeRegistry from './components/ThemeRegistry';

export const metadata = {
  title: 'STEM-ACT',
  description: 'STEM events across Connecticut',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <AdminNav>{children}</AdminNav>
        </ThemeRegistry>
      </body>
    </html>
  );
}
```

**Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully`

**Step 5: Commit**

```bash
git add app/components/theme.js app/components/ThemeRegistry.js app/layout.js
git commit -m "feat: add MUI theme and ThemeRegistry"
```

---

## Task 2: Backend — Add `status` Filter to GET /api/events

**Files:**
- Modify: `backend/api/main.py` (find the `list_events` function)

**Step 1: Read the current endpoint**

Find `@app.get("/api/events")` in `main.py`. It currently accepts `org_id: int = None`.

**Step 2: Add `status` parameter**

```python
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
```

**Step 3: Test manually (backend must be running)**

```bash
curl "http://localhost:8000/api/events?status=approved"
# Expected: {"success": true, "events": [...only approved events...]}
```

**Step 4: Commit**

```bash
git add backend/api/main.py
git commit -m "feat: add status filter to GET /api/events"
```

---

## Task 3: PublicAppBar Component

The public navbar shown on `/`, `/login`, `/register`.

**Files:**
- Create: `app/components/PublicAppBar.js`

**Step 1: Create the component**

```jsx
// app/components/PublicAppBar.js
'use client';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import Link from 'next/link';

export default function PublicAppBar() {
  return (
    <AppBar position="static" sx={{ bgcolor: 'primary.dark' }}>
      <Toolbar>
        <Typography
          variant="h6"
          component={Link}
          href="/"
          sx={{ flexGrow: 1, color: 'white', textDecoration: 'none', fontWeight: 700 }}
        >
          STEM-ACT
        </Typography>
        <Button
          component={Link}
          href="/submit"
          variant="outlined"
          sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: 'white' } }}
        >
          Submit an Event
        </Button>
      </Toolbar>
    </AppBar>
  );
}
```

**Step 2: Verify build**

```bash
npm run build 2>&1 | tail -15
```

**Step 3: Commit**

```bash
git add app/components/PublicAppBar.js
git commit -m "feat: add PublicAppBar for public-facing pages"
```

---

## Task 4: MiniSidebar Component

Hover-to-expand sidebar for admin pages. Collapsed = 65px (icons only). Expanded = 240px (icons + labels) on mouse hover.

**Files:**
- Create: `app/components/MiniSidebar.js`

**Step 1: Create the component**

```jsx
// app/components/MiniSidebar.js
'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Tooltip, Divider, Box
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';

const COLLAPSED_WIDTH = 65;
const EXPANDED_WIDTH = 240;

const NAV_ITEMS = [
  { label: 'Event Submissions', icon: <DashboardIcon />, href: '/superAdminDashboard' },
  { label: 'Partners',          icon: <BusinessIcon />,  href: '/partners' },
  { label: 'Users',             icon: <PeopleIcon />,    href: '/users' },
];

export default function MiniSidebar({ children }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="permanent"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        sx={{
          width: open ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          transition: 'width 0.2s ease',
          '& .MuiDrawer-paper': {
            width: open ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
            transition: 'width 0.2s ease',
            overflowX: 'hidden',
            bgcolor: 'primary.dark',
            color: 'white',
            border: 'none',
          },
        }}
      >
        <Toolbar />
        <List sx={{ pt: 1 }}>
          {NAV_ITEMS.map(({ label, icon, href }) => {
            const active = pathname === href;
            return (
              <Tooltip key={href} title={open ? '' : label} placement="right">
                <ListItemButton
                  onClick={() => router.push(href)}
                  selected={active}
                  sx={{
                    minHeight: 48,
                    justifyContent: open ? 'initial' : 'center',
                    px: 2.5,
                    color: 'white',
                    '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.15)' },
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <ListItemIcon sx={{ color: 'white', minWidth: 0, mr: open ? 2 : 'auto', justifyContent: 'center' }}>
                    {icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={label}
                    sx={{ opacity: open ? 1 : 0, transition: 'opacity 0.2s', color: 'white' }}
                  />
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', mt: 'auto' }} />
        <Tooltip title={open ? '' : 'Logout'} placement="right">
          <ListItemButton
            onClick={handleLogout}
            sx={{
              minHeight: 48,
              justifyContent: open ? 'initial' : 'center',
              px: 2.5,
              color: 'white',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <ListItemIcon sx={{ color: 'white', minWidth: 0, mr: open ? 2 : 'auto', justifyContent: 'center' }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText
              primary="Logout"
              sx={{ opacity: open ? 1 : 0, transition: 'opacity 0.2s', color: 'white' }}
            />
          </ListItemButton>
        </Tooltip>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
```

**Step 2: Verify build**

```bash
npm run build 2>&1 | tail -15
```

**Step 3: Commit**

```bash
git add app/components/MiniSidebar.js
git commit -m "feat: add hover-to-expand MiniSidebar for admin layout"
```

---

## Task 5: PartnerAppBar Component

Simple AppBar for `/partner` — brand + "My Events" label + logout.

**Files:**
- Create: `app/components/PartnerAppBar.js`

**Step 1: Create the component**

```jsx
// app/components/PartnerAppBar.js
'use client';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useRouter } from 'next/navigation';

export default function PartnerAppBar() {
  const router = useRouter();
  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  return (
    <AppBar position="static" sx={{ bgcolor: 'primary.dark' }}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1, color: 'white', fontWeight: 700 }}>
          STEM-ACT
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)' }}>
            My Events
          </Typography>
          <Button
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
            sx={{ color: 'white' }}
          >
            Logout
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
```

**Step 2: Verify build**

```bash
npm run build 2>&1 | tail -15
```

**Step 3: Commit**

```bash
git add app/components/PartnerAppBar.js
git commit -m "feat: add PartnerAppBar for partner layout"
```

---

## Task 6: AdminNav Refactor (Layout Switcher)

Replace the current `AdminNav.js` with a proper layout switcher that renders the correct shell per route. Also add an `AppBar` for admin pages.

**Files:**
- Modify: `app/components/AdminNav.js`

**Step 1: Read the current file**

Read `app/components/AdminNav.js` to understand what exists.

**Step 2: Rewrite it**

```jsx
// app/components/AdminNav.js
'use client';
import { usePathname } from 'next/navigation';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import RouteGuard from './RouteGuard';
import PublicAppBar from './PublicAppBar';
import MiniSidebar from './MiniSidebar';
import PartnerAppBar from './PartnerAppBar';

// No nav at all
const NO_NAV_ROUTES = new Set(['/submit']);

// Public layout (PublicAppBar, no auth)
const PUBLIC_ROUTES = new Set(['/', '/login', '/register']);

// Partner layout (PartnerAppBar, RouteGuard)
const PARTNER_ROUTES = new Set(['/partner']);

// Everything else = admin layout (AppBar + MiniSidebar, RouteGuard)

export default function AdminNav({ children }) {
  const pathname = usePathname();

  if (NO_NAV_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  if (PUBLIC_ROUTES.has(pathname)) {
    return (
      <>
        <PublicAppBar />
        {children}
      </>
    );
  }

  if (PARTNER_ROUTES.has(pathname)) {
    return (
      <RouteGuard>
        <PartnerAppBar />
        <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
          {children}
        </Box>
      </RouteGuard>
    );
  }

  // Admin layout
  return (
    <RouteGuard>
      <AppBar position="fixed" sx={{ bgcolor: 'primary.dark', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
            STEM-ACT
          </Typography>
        </Toolbar>
      </AppBar>
      <MiniSidebar>{children}</MiniSidebar>
    </RouteGuard>
  );
}
```

**Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully` with all routes listed.

**Step 4: Commit**

```bash
git add app/components/AdminNav.js
git commit -m "feat: refactor AdminNav as layout switcher with public/partner/admin shells"
```

---

## Task 7: Public Events Page (`/`)

Replace the current login home page with a public event listing page. The login moves entirely to `/login`.

**Files:**
- Modify: `app/page.js`

**Step 1: Read current `app/page.js`**

It currently renders `<LogIn />`. Replace entirely.

**Step 2: Write the new page**

This is a server component that fetches approved events from the API, then passes them to a client component for filtering.

```jsx
// app/page.js
import { Box, Typography, Container } from '@mui/material';
import PublicEventsClient from './components/PublicEventsClient';

async function getApprovedEvents() {
  try {
    const res = await fetch('http://localhost:8000/api/events?status=approved', {
      cache: 'no-store',
    });
    const data = await res.json();
    return data.success ? data.events : [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const events = await getApprovedEvents();
  return (
    <Box>
      {/* Hero */}
      <Box sx={{ bgcolor: 'primary.dark', color: 'white', py: 5, px: 3, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight={700}>
          STEM Events in Connecticut
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
          Discover approved STEM events near you — for students, families, and educators.
        </Typography>
      </Box>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <PublicEventsClient events={events} />
      </Container>
    </Box>
  );
}
```

**Step 3: Create the client filter + card component**

```jsx
// app/components/PublicEventsClient.js
'use client';
import { useState, useMemo } from 'react';
import {
  Box, Grid, Card, CardContent, CardActions, Typography,
  Button, Select, MenuItem, FormControl, InputLabel, Chip, Stack
} from '@mui/material';
import Link from 'next/link';

const CT_COUNTIES = ['Fairfield','Hartford','Litchfield','Middlesex','New Haven','New London','Tolland','Windham'];

export default function PublicEventsClient({ events }) {
  const [county, setCounty] = useState('');
  const [audience, setAudience] = useState('');

  const audiences = useMemo(() => {
    const vals = events.map(e => e.audience).filter(Boolean);
    return [...new Set(vals)].sort();
  }, [events]);

  const filtered = useMemo(() => events.filter(e => {
    if (county && e.county !== county) return false;
    if (audience && e.audience !== audience) return false;
    return true;
  }), [events, county, audience]);

  const clearFilters = () => { setCounty(''); setAudience(''); };
  const hasFilters = county || audience;

  return (
    <>
      {/* Filter bar */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" mb={3}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="county-label">County</InputLabel>
          <Select
            labelId="county-label"
            value={county}
            label="County"
            onChange={e => setCounty(e.target.value)}
          >
            <MenuItem value="">All Counties</MenuItem>
            {CT_COUNTIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="audience-label">Audience</InputLabel>
          <Select
            labelId="audience-label"
            value={audience}
            label="Audience"
            onChange={e => setAudience(e.target.value)}
          >
            <MenuItem value="">All Audiences</MenuItem>
            {audiences.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
          </Select>
        </FormControl>

        {hasFilters && (
          <Button variant="text" onClick={clearFilters}>Clear Filters</Button>
        )}

        <Typography
          variant="body2"
          color="text.secondary"
          aria-live="polite"
          aria-atomic="true"
          sx={{ ml: 'auto' }}
        >
          {filtered.length} {filtered.length === 1 ? 'event' : 'events'} found
        </Typography>
      </Stack>

      {/* Cards */}
      {filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary">
            No events found. Try clearing the filters.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filtered.map(event => (
            <Grid item xs={12} sm={6} md={4} key={event.event_id}>
              <Card elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom sx={{ lineHeight: 1.3 }}>
                    {event.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {event.start_datetime
                      ? new Date(event.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Date TBD'
                    } · {event.city}, {event.county}
                  </Typography>
                  {event.cost && (
                    <Chip label={event.cost} size="small" sx={{ mb: 1 }} />
                  )}
                  <Typography variant="body2" sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {event.description}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!event.hyperlink}
                    component={event.hyperlink ? Link : 'button'}
                    href={event.hyperlink || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`More Info: ${event.title}`}
                  >
                    More Info
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </>
  );
}
```

**Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```

**Step 5: Commit**

```bash
git add app/page.js app/components/PublicEventsClient.js
git commit -m "feat: add public events listing page at / with county and audience filters"
```

---

## Task 8: Login Page — MUI Rewrite

**Files:**
- Modify: `app/components/LogIn.js`
- Modify: `app/login/page.js`
- Check: `app/page.js` — the root `/` no longer renders login, so `app/login/page.js` is now the login entry point

**Step 1: Read both files**

Read `app/components/LogIn.js` and `app/login/page.js`.

**Step 2: Rewrite LogIn.js with MUI**

Keep ALL existing logic (Zod validation, fetch call, localStorage, router.push). Only replace the JSX:

```jsx
return (
  <Box sx={{
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', bgcolor: 'background.default', px: 2,
  }}>
    <Card elevation={4} sx={{ width: '100%', maxWidth: 420, p: 2 }}>
      <CardContent>
        <Typography variant="h5" align="center" fontWeight={700} color="primary.dark" gutterBottom>
          Sign In
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
          STEM-ACT Admin & Partner Portal
        </Typography>

        <Box component="form" onSubmit={handleFormSubmit} noValidate>
          <Stack spacing={2}>
            <TextField
              label="Email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              fullWidth
              required
              error={Boolean(errors.email)}
              helperText={errors.email?._errors?.[0]}
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              fullWidth
              required
              error={Boolean(errors.password)}
              helperText={errors.password?._errors?.[0]}
            />
            {loginError && <Alert severity="error">{loginError}</Alert>}
            <Button type="submit" variant="contained" fullWidth size="large">
              Log In
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  </Box>
);
```

Add required MUI imports: `Card, CardContent, TextField, Button, Alert, Stack, Box, Typography`.

**Step 3: Update login page wrapper**

```jsx
// app/login/page.js
import LogIn from '../components/LogIn';
export default function LogInPage() {
  return <LogIn />;
}
```

**Step 4: Verify build**

```bash
npm run build 2>&1 | tail -15
```

**Step 5: Commit**

```bash
git add app/components/LogIn.js app/login/page.js
git commit -m "feat: rewrite login page with MUI card layout"
```

---

## Task 9: Register Page — MUI Rewrite

**Files:**
- Modify: `app/components/RegisterForm.js`
- Modify: `app/register/page.js`

**Step 1: Read both files**

Read `app/components/RegisterForm.js` (already updated with invite token + event step logic) and `app/register/page.js`.

**Step 2: Rewrite the base registration form JSX with MUI**

Keep ALL existing logic (Zod, handleChange, handleFormSubmit, invite token useEffect, registered/addingEvents states). Only replace the raw HTML form JSX with MUI equivalents:

- All `<input>` → `<TextField>`
- `<button type="submit">Submit</button>` → `<Button variant="contained" fullWidth>`
- Wrap in a centered Card (same pattern as login)
- Password requirements list → MUI `<List>` with `<ListItem>` or keep as a simple `<Typography>` block

The post-registration prompt and event step sections also get MUI styling:
- Use `<Stack spacing={2}>` for button groups
- Use `<Button variant="contained">` and `<Button variant="outlined">`

**Step 3: Update the register page wrapper**

```jsx
// app/register/page.js
import RegisterForm from '../components/RegisterForm';
export default function RegisterPage() {
  return <RegisterForm />;
}
```

The `RegisterForm` component itself should render the centered card layout (matching login).

**Step 4: Verify build**

```bash
npm run build 2>&1 | tail -15
```

**Step 5: Commit**

```bash
git add app/components/RegisterForm.js app/register/page.js
git commit -m "feat: rewrite register form with MUI"
```

---

## Task 10: Admin Events Table — MUI Rewrite

The `EventsTable` component is 403 lines. Read it fully before touching it.

**Files:**
- Modify: `app/components/EventsTable.js`
- Check: `app/components/DenyModal.js`, `app/components/ApproveModal.js`, `app/components/RevokeModal.js`, `app/components/StatsCards.js`

**Step 1: Read all related files**

```bash
wc -l app/components/DenyModal.js app/components/ApproveModal.js app/components/RevokeModal.js app/components/StatsCards.js
```

Read each file to understand what props they accept.

**Step 2: Rewrite EventsTable.js with MUI**

Keep ALL existing logic (state, filtering, approve/deny handlers, toast). Replace UI:

- Stat cards → MUI `Card` grid (3 cards: Pending/Approved/Denied counts)
- Filter bar → MUI `ToggleButtonGroup` for status, `TextField` for search, `Select` for org filter
- Table → MUI `Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell` inside `TableContainer`/`Paper`
- Status badges → MUI `Chip` (pending=warning, approved=success, denied=error)
- Approve/Deny buttons → MUI `Button` (success color, error color)
- Row expansion (event details) → keep as collapsible MUI `Collapse` + `Box`

Modal components (DenyModal, ApproveModal, RevokeModal) — if they use custom CSS, rewrite them too. If they already use MUI `Dialog`, just verify.

**Step 3: Verify build**

```bash
npm run build 2>&1 | tail -15
```

**Step 4: Commit**

```bash
git add app/components/EventsTable.js app/components/DenyModal.js app/components/ApproveModal.js app/components/RevokeModal.js app/components/StatsCards.js
git commit -m "feat: rewrite admin events table with MUI"
```

---

## Task 11: Partners Table — MUI Rewrite

**Files:**
- Read: `app/partners/PartnersTable.js` — read first to understand the full component
- Modify: `app/partners/PartnersTable.js`

**Step 1: Read the file**

```bash
wc -l app/partners/PartnersTable.js
cat app/partners/PartnersTable.js  # or use Read tool
```

**Step 2: Rewrite with MUI**

Keep all logic. Replace UI:
- Table → MUI `Table` in `TableContainer`/`Paper`
- Status badges → MUI `Chip`
- Action buttons → MUI `Button`
- Any modals → MUI `Dialog`

**Step 3: Verify build + commit**

```bash
npm run build 2>&1 | tail -15
git add app/partners/PartnersTable.js
git commit -m "feat: rewrite partners table with MUI"
```

---

## Task 12: Users Table — MUI Rewrite

**Files:**
- Modify: `app/users/UsersTable.js`

**Step 1: Read the file**

`UsersTable.js` is already partially modernized. Read it fully.

**Step 2: Rewrite with MUI**

Keep all logic (invite link generation, role edit, delete). Replace UI:
- Stat cards → MUI `Card` grid
- Search/filter bar → MUI `TextField` + `Select`
- Table → MUI `Table` in `Paper`
- Role badges → MUI `Chip`
- Invite section → MUI `Card` with `Select` + `Button` + copyable `TextField`
- Edit/Delete modals → rewrite `EditRoleModal.js` and `DeleteUserModal.js` if they use custom CSS

**Step 3: Verify build + commit**

```bash
npm run build 2>&1 | tail -15
git add app/users/UsersTable.js app/components/EditRoleModal.js app/components/DeleteUserModal.js
git commit -m "feat: rewrite users table and modals with MUI"
```

---

## Task 13: Strip globals.css

After all pages are on MUI, remove the custom CSS classes that are no longer referenced.

**Files:**
- Modify: `app/globals.css`

**Step 1: Check for remaining references**

```bash
grep -r "className=" app/components/ app/app/ --include="*.js" | grep -v "mui\|MUI" | grep -E "dashboard|login-container|register|form-field|stat-card|data-table|nav-links" | head -30
```

If any custom classes are still in use, fix those components first.

**Step 2: Strip globals.css to only the necessary rules**

Keep:
- Reset (`*, body`)
- `prefers-reduced-motion` rule
- `*:focus-visible` outline rule
- Any MUI override rules needed

Delete all custom component classes (`.navbar`, `.login-form`, `.form-fields`, `.data-table`, `.stat-card`, `.modal-overlay`, `.toast-container`, etc.).

**Step 3: Verify build**

```bash
npm run build 2>&1 | tail -15
```

**Step 4: Smoke test**

Start the dev server and verify each page visually:
```bash
npm run dev
```
- `/` — public events page loads, filters work
- `/login` — centered card, form works
- `/register` — centered card, form works
- `/superAdminDashboard` — sidebar shows, table loads
- `/partners` — sidebar shows, table loads
- `/users` — sidebar shows, invite link works
- `/partner` — partner AppBar shows, events table loads
- `/submit` — no nav, form works

**Step 5: Commit**

```bash
git add app/globals.css
git commit -m "chore: strip custom CSS classes replaced by MUI"
```

---

## Summary

| Task | Files | Key change |
|---|---|---|
| 1 | `theme.js`, `ThemeRegistry.js`, `layout.js` | MUI theme + CssBaseline |
| 2 | `backend/api/main.py` | `status` filter on GET /api/events |
| 3 | `PublicAppBar.js` | New public navbar |
| 4 | `MiniSidebar.js` | Hover-to-expand admin sidebar |
| 5 | `PartnerAppBar.js` | Partner navbar |
| 6 | `AdminNav.js` | Layout switcher |
| 7 | `page.js`, `PublicEventsClient.js` | Public events listing page |
| 8 | `LogIn.js`, `login/page.js` | MUI login card |
| 9 | `RegisterForm.js`, `register/page.js` | MUI register card |
| 10 | `EventsTable.js` + modals | MUI admin events table |
| 11 | `partners/PartnersTable.js` | MUI partners table |
| 12 | `UsersTable.js` + modals | MUI users table |
| 13 | `globals.css` | Strip all custom CSS |
