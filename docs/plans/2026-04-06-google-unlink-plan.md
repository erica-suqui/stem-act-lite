# Admin Google Account Unlink Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let admins see whether a partner has a linked Google account and unlink it from the Users Table.

**Architecture:** One new backend endpoint sets `google_sub = NULL`. The users page query exposes a `google_linked` boolean. UsersTable gets a new Google column and an Unlink button that only renders when connected.

**Tech Stack:** FastAPI + SQLAlchemy raw SQL (Python), Next.js 15 App Router, MUI v6, PostgreSQL on port 5433.

---

## Task 1: Backend — Add Unlink Endpoint

**Files:**
- Modify: `stemApp/backend/api/main.py` (after the `delete_user` endpoint, around line 1079)

**Step 1: Add the endpoint**

After the `delete_user` function (around line 1079), add:

```python
@app.post("/api/users/{user_id}/unlink-google")
def unlink_google(user_id: int, db: Session = Depends(get_db)):
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
```

**Step 2: Start the backend and smoke-test**

```bash
cd stemApp/backend && uvicorn api.main:app --reload --port 8000
```

In a second terminal, test with a non-existent user:
```bash
curl -s -X POST http://localhost:8000/api/users/99999/unlink-google | python3 -m json.tool
```
Expected: `{"success": false, "message": "User not found"}`

Test with a user that has no Google account (any existing email/password user):
```bash
curl -s -X POST http://localhost:8000/api/users/1/unlink-google | python3 -m json.tool
```
Expected: `{"success": false, "message": "No Google account linked"}`

**Step 3: Commit**

```bash
git add stemApp/backend/api/main.py
git commit -m "feat: add POST /api/users/{user_id}/unlink-google endpoint"
```

---

## Task 2: Frontend — Expose google_linked in Users Query

**Files:**
- Modify: `stemApp/app/users/page.js`

**Step 1: Add google_linked to the SQL query**

Find the `getUsers` function (around line 12). Change the query from:

```js
const result = await pool.query(`
    SELECT
        u.user_id,
        u.email,
        u.role,
        o.org_name
    FROM users u
    LEFT JOIN organizations o ON o.org_id = u.org_id
    ORDER BY u.user_id DESC
`);
```

To:

```js
const result = await pool.query(`
    SELECT
        u.user_id,
        u.email,
        u.role,
        o.org_name,
        u.google_sub IS NOT NULL AS google_linked
    FROM users u
    LEFT JOIN organizations o ON o.org_id = u.org_id
    ORDER BY u.user_id DESC
`);
```

**Step 2: Verify the query returns the new field**

Start the dev server:
```bash
cd stemApp && npm run dev
```

Open http://localhost:3000/users in a browser (log in as admin first). The page should still load without errors. The `google_linked` field is now in the data passed to `UsersTable` — it just won't show yet until Task 3.

**Step 3: Commit**

```bash
git add stemApp/app/users/page.js
git commit -m "feat: include google_linked boolean in users page query"
```

---

## Task 3: Frontend — Add Google Column and Unlink Button to UsersTable

**Files:**
- Modify: `stemApp/app/users/UsersTable.js`

**Step 1: Add google_linked to the stats/filter logic**

No changes needed to stats or filters — `google_linked` is just a display field.

**Step 2: Add "Google" column header**

Find the headers array (around line 147):
```js
{['Email', 'Role', 'Organization', 'Actions'].map(h => (
```

Change to:
```js
{['Email', 'Role', 'Organization', 'Google', 'Actions'].map(h => (
```

**Step 3: Add Google cell and Unlink button to each row**

Find the row rendering inside the `.map(user => ...)` block. After the Organization `<TableCell>` (around line 162), add:

```jsx
<TableCell>
  {user.google_linked
    ? <Chip label="Connected" color="success" size="small" />
    : <Typography variant="body2" color="text.secondary">—</Typography>
  }
</TableCell>
```

In the Actions `<TableCell>`, after the Delete button, add:

```jsx
{user.google_linked && (
  <Button
    size="small"
    variant="outlined"
    color="warning"
    disabled={isLoading}
    onClick={() => handleUnlinkGoogle(user)}
    aria-label={`Unlink Google account for ${user.email}`}
  >
    Unlink Google
  </Button>
)}
```

**Step 4: Add the handleUnlinkGoogle function**

After the `handleEditRole` function (around line 97), add:

```js
const handleUnlinkGoogle = useCallback(async (user) => {
  setLoadingId(user.user_id);
  try {
    const res = await fetch(apiUrl(`/api/users/${user.user_id}/unlink-google`), { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setUsers(prev => prev.map(u =>
        u.user_id === user.user_id ? { ...u, google_linked: false } : u
      ));
      addToast(`Google account unlinked from ${user.email}.`, 'success');
    } else {
      addToast('Error: ' + data.message, 'error');
    }
  } catch {
    addToast('Network error. Please try again.', 'error');
  } finally {
    setLoadingId(null);
  }
}, []);
```

**Step 5: Update colSpan in the empty state row**

Find the "No users match your search" row (around line 181):
```jsx
<TableCell colSpan={4} ...>
```
Change to:
```jsx
<TableCell colSpan={5} ...>
```

**Step 6: Verify visually**

1. Open http://localhost:3000/users
2. Confirm a "Google" column appears between Organization and Actions
3. Users with no Google account show "—"
4. If you have a test user with `google_sub` set in the DB, confirm "Connected" chip and "Unlink Google" button appear
5. Click "Unlink Google" — confirm the chip disappears and toast shows success

To set up a test user with google_sub for manual testing:
```bash
PGPASSWORD=stemact_pass psql -h 127.0.0.1 -p 5433 -U stemact_user -d stemact \
  -c "UPDATE users SET google_sub = 'test_sub_123' WHERE email = 'your-test-user@example.com';"
```

**Step 7: Commit**

```bash
git add stemApp/app/users/UsersTable.js
git commit -m "feat: add Google account status column and unlink action to UsersTable"
```
