# Form Polish & Dynamic Inputs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add real-time validation, phone formatting, password show/hide, accessibility fixes, and event form section grouping across all STEM-ACT forms.

**Architecture:** Extract a `useField` hook for validation lifecycle (blur-first, then live-after-touch) and a `PhoneField` component for formatted phone input. Apply these + mechanical aria/label/section fixes across all forms. No backend changes.

**Tech Stack:** Next.js 16, React 19, MUI v7, Zod v4

---

## Task 1: Create `useField` validation hook

**Files:**
- Create: `stemApp/app/hooks/useField.js`

### What this does
Manages form state, per-field "touched" tracking, and Zod validation. Errors only show after a field is touched (blurred). Once touched, errors update on every keystroke.

### Step 1: Create the file

```js
// stemApp/app/hooks/useField.js
'use client';
import { useState, useCallback } from 'react';

/**
 * useField — form state + validation lifecycle hook
 *
 * @param {object} schema      - Zod schema for the whole form
 * @param {object} initial     - initial field values { fieldName: '' }
 * @param {function} onSubmit  - async (validData) => void, called only when schema passes
 * @returns {{ values, errors, handleChange, handleBlur, handleSubmit, setValues }}
 *
 * Error format: flat object { fieldName: 'error message' }
 * (NOT Zod's .format() nested structure)
 */
export function useField(schema, initial, onSubmit) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const extractErrors = (zodResult) => {
    if (zodResult.success) return {};
    const flat = {};
    for (const issue of zodResult.error.issues) {
      const field = issue.path[0];
      if (field && !flat[field]) flat[field] = issue.message;
    }
    return flat;
  };

  const validateOne = useCallback((name, currentValues) => {
    const result = schema.safeParse(currentValues);
    const flat = extractErrors(result);
    return flat[name] ?? null;
  }, [schema]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    const next = { ...values, [name]: value };
    setValues(next);
    if (touched[name]) {
      const error = validateOne(name, next);
      setErrors(prev => {
        const updated = { ...prev };
        if (error) updated[name] = error;
        else delete updated[name];
        return updated;
      });
    }
  }, [values, touched, validateOne]);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateOne(name, values);
    setErrors(prev => {
      const updated = { ...prev };
      if (error) updated[name] = error;
      else delete updated[name];
      return updated;
    });
  }, [values, validateOne]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    // Touch all fields so errors appear
    const allTouched = Object.fromEntries(Object.keys(initial).map(k => [k, true]));
    setTouched(allTouched);

    const result = schema.safeParse(values);
    if (!result.success) {
      setErrors(extractErrors(result));
      return;
    }
    setErrors({});
    onSubmit(result.data);
  }, [values, schema, initial, onSubmit]);

  return { values, errors, handleChange, handleBlur, handleSubmit, setValues };
}
```

### Step 2: Verify file exists and has no syntax errors

Run the dev server and confirm no import errors:
```bash
cd stemApp && npm run dev
```
Expected: server starts, no module errors in terminal.

### Step 3: Commit
```bash
git add stemApp/app/hooks/useField.js
git commit -m "feat: add useField validation hook with blur-first live validation"
```

---

## Task 2: Create `PhoneField` component

**Files:**
- Create: `stemApp/app/components/PhoneField.js`

### What this does
Displays a formatted phone number `(203) 555-1212` while storing raw digits `2035551212` in state. Accepts same props as MUI `TextField`.

### Step 1: Create the file

```js
// stemApp/app/components/PhoneField.js
'use client';
import { TextField } from '@mui/material';

function formatPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * PhoneField — MUI TextField that formats display as (XXX) XXX-XXXX
 * and stores raw 10-digit string in state via onChange.
 *
 * Props: same as MUI TextField. value must be raw digits string.
 * onChange receives a synthetic event: { target: { name, value: rawDigits } }
 */
export default function PhoneField({ value, onChange, name, ...props }) {
  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    onChange({ target: { name, value: raw } });
  };

  return (
    <TextField
      {...props}
      name={name}
      value={formatPhone(value)}
      onChange={handleChange}
      inputMode="numeric"
      slotProps={{
        ...props.slotProps,
        input: {
          ...props.slotProps?.input,
          'aria-describedby': `${name}-helper`,
          'aria-required': props.required ? 'true' : undefined,
        },
        formHelperText: { id: `${name}-helper` },
      }}
    />
  );
}
```

### Step 2: Verify
Open the browser, navigate to `/register`. The phone field should not be changed yet — just verify dev server still starts.

### Step 3: Commit
```bash
git add stemApp/app/components/PhoneField.js
git commit -m "feat: add PhoneField component with (XXX) XXX-XXXX formatting"
```

---

## Task 3: Extract `FlyerUpload` to shared component

**Files:**
- Create: `stemApp/app/components/FlyerUpload.js`
- Modify: `stemApp/app/components/EventSubmissionForm.js` (remove inline FlyerUpload, import shared one)

### What this does
The `FlyerUpload` component is currently defined inline inside `EventSubmissionForm.js`. Moving it to its own file lets `submit/page.js` use it too.

### Step 1: Create `FlyerUpload.js`

Copy the existing `FlyerUpload` function (lines 71–158 of `EventSubmissionForm.js`) into its own file:

```js
// stemApp/app/components/FlyerUpload.js
'use client';
import { useRef, useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FlyerUpload({ flyerFile, setFlyerFile }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setFlyerFile(file);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Flyer{' '}
        <Typography component="span" variant="caption" color="text.disabled">
          (PDF, JPG, or PNG — max 10MB)
        </Typography>
      </Typography>

      {flyerFile ? (
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
            border: '1px solid', borderColor: 'primary.main', borderRadius: 2, bgcolor: 'primary.50',
          }}
        >
          <InsertDriveFileIcon color="primary" fontSize="small" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={500} noWrap>{flyerFile.name}</Typography>
            <Typography variant="caption" color="text.secondary">{formatSize(flyerFile.size)}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setFlyerFile(null)} aria-label="Remove flyer">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ) : (
        <Box
          role="button"
          tabIndex={0}
          aria-label="Upload flyer — drag and drop or click to browse"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          sx={{
            border: '2px dashed',
            borderColor: dragging ? 'primary.main' : 'grey.300',
            borderRadius: 2, p: 3, textAlign: 'center', cursor: 'pointer',
            bgcolor: dragging ? 'primary.50' : 'grey.50',
            transition: 'all 0.15s ease',
            '&:hover': { borderColor: 'primary.light', bgcolor: 'primary.50' },
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 32, color: dragging ? 'primary.main' : 'grey.400', mb: 0.5 }} />
          <Typography variant="body2" color={dragging ? 'primary.main' : 'text.secondary'}>
            {dragging ? 'Drop it here' : 'Drag & drop or click to browse'}
          </Typography>
          <Typography variant="caption" color="text.disabled">PDF, JPG, PNG up to 10 MB</Typography>
        </Box>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={(e) => setFlyerFile(e.target.files?.[0] || null)}
      />
    </Box>
  );
}
```

> **Note vs original:** Added `role="button"`, `tabIndex={0}`, `aria-label`, and `onKeyDown` so keyboard users can activate the upload zone. Also extracted `formatSize` out of the component.

### Step 2: Update `EventSubmissionForm.js` imports

At the top of `EventSubmissionForm.js`, replace:
```js
// Remove the inline FlyerUpload function (lines 71–158)
```
And add the import:
```js
import FlyerUpload from './FlyerUpload';
```

The rest of `EventSubmissionForm.js` stays unchanged for now.

### Step 3: Verify
Navigate to the partner event submission form. Flyer upload should still work identically.

### Step 4: Commit
```bash
git add stemApp/app/components/FlyerUpload.js stemApp/app/components/EventSubmissionForm.js
git commit -m "refactor: extract FlyerUpload to shared component, add keyboard accessibility"
```

---

## Task 4: Refactor `LogIn.js`

**Files:**
- Modify: `stemApp/app/components/LogIn.js`

### Changes
1. Replace manual `useState` + `handleChange` with `useField` hook
2. Add password show/hide toggle
3. Add aria attributes to TextFields
4. Unify card `maxWidth` to `420`

### Step 1: Rewrite `LogIn.js`

```js
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState } from 'react';
import * as z from 'zod';
import { apiUrl } from '@/lib/api';
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Alert, Stack, FormControlLabel, Checkbox,
  InputAdornment, IconButton,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import Link from 'next/link';
import { useField } from '@/app/hooks/useField';

const logInSchema = z.object({
  email: z.string().email('Invalid email').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

const INITIAL = { email: '', password: '' };

export default function LogIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justReset = searchParams.get('reset') === '1';
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { values, errors, handleChange, handleBlur, handleSubmit } = useField(
    logInSchema,
    INITIAL,
    async (validData) => {
      setLoginError('');
      setIsSubmitting(true);
      try {
        const response = await fetch(apiUrl('/api/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validData),
        });
        const data = await response.json();
        if (data.success) {
          const storage = rememberMe ? localStorage : sessionStorage;
          storage.setItem('userID', data.userID);
          storage.setItem('role', data.role);
          storage.setItem('orgId', data.orgId);
          const roleRoutes = { partner: '/partner', admin: '/superAdminDashboard', super_admin: '/superAdminDashboard' };
          router.push(roleRoutes[data.role] || '/');
        } else {
          setLoginError(data.error || 'Login failed');
        }
      } catch {
        setLoginError('Something went wrong');
      } finally {
        setIsSubmitting(false);
      }
    }
  );

  return (
    <Box component="main" sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', bgcolor: 'background.default', px: 2,
    }}>
      <Card elevation={4} sx={{ width: '100%', maxWidth: 420, p: 2 }}>
        <CardContent>
          <Typography variant="h5" component="h1" align="center" fontWeight={700} color="primary.dark" gutterBottom>
            Sign In
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            STEM-ACT
          </Typography>
          {justReset && (
            <Alert severity="success" sx={{ mb: 2 }}>Password reset successfully. Please log in.</Alert>
          )}
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Email"
                name="email"
                type="email"
                value={values.email}
                onChange={handleChange}
                onBlur={handleBlur}
                fullWidth
                required
                error={Boolean(errors.email)}
                helperText={errors.email}
                slotProps={{
                  input: { 'aria-describedby': 'email-helper', 'aria-required': 'true' },
                  formHelperText: { id: 'email-helper' },
                }}
              />
              <TextField
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={values.password}
                onChange={handleChange}
                onBlur={handleBlur}
                fullWidth
                required
                error={Boolean(errors.password)}
                helperText={errors.password}
                slotProps={{
                  input: {
                    'aria-describedby': 'password-helper',
                    'aria-required': 'true',
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPassword(v => !v)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                  formHelperText: { id: 'password-helper' },
                }}
              />
              {loginError && <Alert severity="error">{loginError}</Alert>}
              <FormControlLabel
                control={<Checkbox checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />}
                label="Remember Me"
              />
              <Button type="submit" variant="contained" fullWidth size="large" disabled={isSubmitting}>
                Log In
              </Button>
              <Typography variant="body2" align="center" color="text.secondary">
                <Link href="/forgot-password" style={{ color: 'inherit' }}>Forgot password?</Link>
              </Typography>
              <Typography variant="body2" align="center" color="text.secondary">
                Not registered?{' '}
                <Link href="/register" style={{ color: 'inherit' }}>Register here</Link>
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
```

### Step 2: Verify manually
1. Navigate to `/login`
2. Click submit without filling in fields — both fields should show errors immediately
3. Fill in email, tab away — email error should clear, password error remains
4. Type in password field — error clears as you type (after having been shown once)
5. Click the eye icon — password becomes visible
6. Submit with wrong credentials — server error appears below password field

### Step 3: Commit
```bash
git add stemApp/app/components/LogIn.js
git commit -m "refactor: LogIn — useField hook, password toggle, aria, unified card width"
```

---

## Task 5: Refactor `signup/page.js`

**Files:**
- Modify: `stemApp/app/signup/page.js`

### Changes
Same pattern as LogIn: useField hook, password show/hide on both password fields, aria, `maxWidth: 420`.

### Step 1: Rewrite `signup/page.js`

```js
'use client';

import React, { useState } from 'react';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Alert, Stack, InputAdornment, IconButton,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import Link from 'next/link';
import { useField } from '@/app/hooks/useField';

const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .refine(v => /[A-Z]/.test(v), { message: 'Password must contain an uppercase letter' })
    .refine(v => /[a-z]/.test(v), { message: 'Password must contain a lowercase letter' })
    .refine(v => /[0-9]/.test(v), { message: 'Password must contain a number' }),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const INITIAL = { firstName: '', lastName: '', email: '', password: '', confirmPassword: '' };

export default function SignUpPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { values, errors, handleChange, handleBlur, handleSubmit } = useField(
    signupSchema,
    INITIAL,
    async (validData) => {
      setSubmitError('');
      setLoading(true);
      try {
        const res = await fetch(apiUrl('/api/register/public'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: validData.firstName,
            lastName: validData.lastName,
            email: validData.email,
            password: validData.password,
          }),
        });
        const data = await res.json();
        if (data.success) {
          router.push('/login');
        } else {
          setSubmitError(data.error || 'Sign up failed. Please try again.');
        }
      } catch {
        setSubmitError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  );

  const passwordToggle = (show, setShow) => ({
    endAdornment: (
      <InputAdornment position="end">
        <IconButton
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow(v => !v)}
          edge="end"
        >
          {show ? <VisibilityOffIcon /> : <VisibilityIcon />}
        </IconButton>
      </InputAdornment>
    ),
  });

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', bgcolor: 'background.default', px: 2, py: 4,
    }}>
      <Card elevation={4} sx={{ width: '100%', maxWidth: 420, p: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <Button size="small" variant="text" onClick={() => router.push('/')}>✕ Exit</Button>
          </Box>
          <Typography variant="h5" align="center" fontWeight={700} color="primary.dark" gutterBottom>
            Create an Account
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            Browse and track STEM events in Connecticut
          </Typography>
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="First Name" name="firstName" value={values.firstName}
                  onChange={handleChange} onBlur={handleBlur} fullWidth required
                  error={Boolean(errors.firstName)} helperText={errors.firstName}
                  slotProps={{ input: { 'aria-describedby': 'firstName-helper', 'aria-required': 'true' }, formHelperText: { id: 'firstName-helper' } }}
                />
                <TextField
                  label="Last Name" name="lastName" value={values.lastName}
                  onChange={handleChange} onBlur={handleBlur} fullWidth required
                  error={Boolean(errors.lastName)} helperText={errors.lastName}
                  slotProps={{ input: { 'aria-describedby': 'lastName-helper', 'aria-required': 'true' }, formHelperText: { id: 'lastName-helper' } }}
                />
              </Stack>
              <TextField
                label="Email" name="email" type="email" value={values.email}
                onChange={handleChange} onBlur={handleBlur} fullWidth required
                error={Boolean(errors.email)} helperText={errors.email}
                slotProps={{ input: { 'aria-describedby': 'email-helper', 'aria-required': 'true' }, formHelperText: { id: 'email-helper' } }}
              />
              <TextField
                label="Password" name="password" type={showPassword ? 'text' : 'password'}
                value={values.password} onChange={handleChange} onBlur={handleBlur} fullWidth required
                error={Boolean(errors.password)}
                helperText={errors.password || 'Min 8 chars, 1 uppercase, 1 lowercase, 1 number'}
                slotProps={{ input: { 'aria-describedby': 'password-helper', 'aria-required': 'true', ...passwordToggle(showPassword, setShowPassword) }, formHelperText: { id: 'password-helper' } }}
              />
              <TextField
                label="Confirm Password" name="confirmPassword" type={showConfirm ? 'text' : 'password'}
                value={values.confirmPassword} onChange={handleChange} onBlur={handleBlur} fullWidth required
                error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword}
                slotProps={{ input: { 'aria-describedby': 'confirmPassword-helper', 'aria-required': 'true', ...passwordToggle(showConfirm, setShowConfirm) }, formHelperText: { id: 'confirmPassword-helper' } }}
              />
              {submitError && <Alert severity="error">{submitError}</Alert>}
              <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}>
                {loading ? 'Creating Account…' : 'Sign Up'}
              </Button>
              <Typography variant="body2" align="center" color="text.secondary">
                Already have an account?{' '}
                <Link href="/login" style={{ color: 'inherit' }}>Sign in</Link>
              </Typography>
              <Typography variant="body2" align="center" color="text.secondary">
                Are you an organization?{' '}
                <Link href="/register" style={{ color: 'inherit' }}>Become a Partner</Link>
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
```

### Step 2: Verify manually
1. Navigate to `/signup`
2. Submit empty form — all required field errors appear
3. Fill first name, blur — first name error clears
4. Enter mismatched passwords — "Passwords do not match" appears after blurring confirm field
5. Eye icons toggle visibility on both password fields

### Step 3: Commit
```bash
git add stemApp/app/signup/page.js
git commit -m "refactor: signup — useField hook, password toggles, aria, unified card width"
```

---

## Task 6: Refactor `forgot-password/page.js` and `reset-password/page.js`

**Files:**
- Modify: `stemApp/app/forgot-password/page.js`
- Modify: `stemApp/app/reset-password/page.js`

### Forgot Password — changes
- Add aria to email TextField
- Unify card `maxWidth` to `420` (already correct at 420, no change needed)
- Note: this form is simple enough that `useField` adds little value (one unvalidated field). Keep existing `useState` — just add aria attributes.

```js
// Only change in forgot-password/page.js: add slotProps to the TextField
<TextField
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  required
  fullWidth
  slotProps={{
    input: { 'aria-describedby': 'email-helper', 'aria-required': 'true' },
    formHelperText: { id: 'email-helper' },
  }}
/>
```

### Reset Password — changes
- Replace manual password validation with `useField` + Zod schema
- Add show/hide toggle to both password fields
- Add aria attributes
- Card `maxWidth: 420` (already correct)

For `reset-password/page.js`, use this schema inside `ResetPasswordForm`:
```js
const resetSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});
```

Replace `useState` for password/confirm with `useField(resetSchema, { password: '', confirm: '' }, async (validData) => { /* existing API call */ })`.

Add show/hide toggles using `InputAdornment` + `IconButton` (same pattern as Tasks 4 and 5).

### Commit
```bash
git add stemApp/app/forgot-password/page.js stemApp/app/reset-password/page.js
git commit -m "refactor: forgot/reset password — aria fixes, useField, password toggles"
```

---

## Task 7: Refactor `RegisterForm.js`

**Files:**
- Modify: `stemApp/app/components/RegisterForm.js`

### Changes
1. Replace manual validation with `useField` hook
2. Replace phone `TextField` with `PhoneField` component
3. Add show/hide toggle to both password fields
4. Add aria attributes
5. Unify card `maxWidth` to `420`

> **Important:** `RegisterForm` has extra state outside of the form schema: `codeStatus`, `codeOrgName`, `submitError`, `emailSent`. These stay as regular `useState`. Only the form field values + validation move to `useField`.

> **Important:** The `partnerCode` field has its own `onBlur` handler (`handleCodeBlur`) that calls the API. When using `useField`, pass both: `onBlur` calls `handleBlur` from the hook AND the API validation. Do this by combining them:
> ```jsx
> onBlur={(e) => { handleBlur(e); handleCodeBlur(); }}
> ```

> **Error format change:** The existing code uses `errors.field?._errors?.[0]` (Zod `.format()` output). `useField` returns flat errors `errors.field`. Update all `helperText` and `error` props accordingly.

Key structural changes:
- `orgName` field: keep the `inputProps={{ readOnly: Boolean(codeOrgName) }}` behavior, but switch to `slotProps` syntax: `slotProps={{ input: { readOnly: Boolean(codeOrgName) } }}`
- Card `maxWidth: 420` (from 480)
- Import `PhoneField` and replace the phone `TextField`
- Import `useField` and `VisibilityIcon`, `VisibilityOffIcon`, `InputAdornment`

### Verify manually
1. Navigate to `/register`
2. Submit empty — all required field errors appear
3. Enter phone as `(203) 555-` — only digits stored, formatted display
4. Enter partner code, blur — API validation still fires
5. Password eye icon toggles visibility

### Commit
```bash
git add stemApp/app/components/RegisterForm.js
git commit -m "refactor: RegisterForm — useField, PhoneField, password toggles, aria, card width"
```

---

## Task 8: Refactor `EventSubmissionForm.js`

**Files:**
- Modify: `stemApp/app/components/EventSubmissionForm.js`

### Changes
1. Replace manual form state with `useField` hook
2. Add section grouping with `Divider` + section headers
3. Make End Date conditional on Start Date being set
4. Add `(optional)` to optional field labels
5. Add aria attributes

### Section structure
```
── Event Details (h2 heading, existing)
── [Divider] Event Basics
     Title, Description, Event Type (chips)
── [Divider] Date & Time
     Start Date & Time
     {values.start_datetime && End Date & Time (optional)}
── [Divider] Location
     Address, City, County
── [Divider] Details (optional)
     Audience (optional), Cost (optional), Event Link (optional), Event Contact Email (optional)
── [Divider] Flyer
     FlyerUpload
── Action buttons
```

### MUI Divider with label pattern
```jsx
import { Divider } from '@mui/material';

<Divider sx={{ mt: 1 }}>
  <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
    Date & Time
  </Typography>
</Divider>
```

### useField integration note
The `event_type` chip selector and `flyerFile` state are NOT part of the Zod schema validation — keep them as regular `useState`. Only the text fields move to `useField`.

The `onSubmit` prop passed to `EventSubmissionForm` takes `(validData, flyerFile)`. In `useField`'s `onSubmit` callback, call `props.onSubmit(validData, flyerFile)`.

### Optional label examples
```jsx
label="Audience (optional)"
label="Cost (optional)"
label="Event Link (optional)"
label="Event Contact Email (optional)"
// End Date & Time already conditional, add (optional) to label too
label="End Date & Time (optional)"
```

### Verify manually
1. Navigate to the partner event submission (requires partner login)
2. Confirm sections appear with dividers
3. Confirm End Date only appears after Start Date is filled
4. Submit empty — required field errors appear
5. Fill Title, blur — error clears, live validation works

### Commit
```bash
git add stemApp/app/components/EventSubmissionForm.js
git commit -m "refactor: EventSubmissionForm — useField, section grouping, end-date conditional, optional labels, aria"
```

---

## Task 9: Refactor `submit/page.js` (public event submission)

**Files:**
- Modify: `stemApp/app/submit/page.js`

### Changes
1. Replace manual form state with `useField` hook
2. Add `PhoneField` for phone input
3. Add section grouping (same structure as EventSubmissionForm + Contact section at top)
4. Add Event Type chip selector (same `EVENT_TYPES` array and chip pattern as EventSubmissionForm)
5. Add `FlyerUpload` component
6. Make End Date conditional on Start Date
7. Add `(optional)` to optional labels
8. Add aria attributes

### Section structure
```
── Submit a STEM Event (h1, existing)
── [Divider] Your Contact Information
     Your Name, Your Email, Your Phone (PhoneField)
── [Divider] Event Basics
     Event Title, Description, Event Type (chips)
── [Divider] Date & Time
     Start Date & Time
     {values.start_datetime && End Date & Time (optional)}
── [Divider] Location
     Address, City, County
── [Divider] Details (optional)
     Audience (optional), Cost (optional), Event Link (optional), Event Contact Email (optional)
── [Divider] Flyer
     FlyerUpload
── Submit button
```

### Event type chips — add to this page
Add the `EVENT_TYPES` constant (same as EventSubmissionForm) and the chip grid. The `event_type` value is held in separate `useState` since it's not part of the Zod schema.

```js
const EVENT_TYPES = [
  'Workshop', 'Field Trip', 'Conference', 'Camp',
  'Competition', 'Lecture', 'Community Event', 'Other',
];
const [eventType, setEventType] = useState('');
const [flyerFile, setFlyerFile] = useState(null);
```

When submitting, include `event_type: eventType` in the API payload (merge with `validData`).

### Zod schema update
The existing `publicSchema` in `submit/page.js` does not include `event_type`. Add it:
```js
event_type: z.string().optional(),
```

But since event_type is managed separately, don't include it in the `useField` schema — just add it to the API payload manually in the `onSubmit` callback.

### Verify manually
1. Navigate to `/submit`
2. Confirm Contact Information section appears at top
3. Confirm phone formats as `(203) 555-1212`
4. Confirm event type chips appear and are selectable
5. Confirm flyer upload zone appears
6. Confirm End Date only appears after Start Date
7. Submit empty — required field errors appear
8. Full happy path: fill all required fields, submit, see success message

### Commit
```bash
git add stemApp/app/submit/page.js
git commit -m "refactor: submit page — useField, PhoneField, sections, event type, flyer upload, optional labels, aria"
```

---

## Final Check

After all tasks complete:

1. Run `npm run build` in `stemApp/` — verify no type errors or build failures
   ```bash
   cd stemApp && npm run build
   ```
   Expected: `✓ Compiled successfully`

2. Run through each form in the browser — verify:
   - No console errors
   - Validation fires on blur, updates live after first touch
   - Phone formats correctly on `/register` and `/submit`
   - Password toggles work on login, signup, register, reset-password
   - Event form sections render with dividers
   - End Date appears only after Start Date on both event forms

3. Final commit if any minor cleanup needed:
   ```bash
   git commit -m "fix: form polish cleanup after full review"
   ```
