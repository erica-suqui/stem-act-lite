# Form Polish & Dynamic Inputs Design

**Date:** 2026-04-06  
**Scope:** All forms in `stemApp/` — event submission, auth, partner registration

---

## Problem

The forms across STEM-ACT have accumulated several inconsistencies and usability gaps:

- Validation only runs on submit — no live feedback after a field is touched
- Phone fields require raw 10 digits with no formatting help; novice users type `(203) 555-1212` and get a confusing error
- Password fields have no show/hide toggle
- Error messages are not linked to inputs via `aria-describedby` — screen readers won't announce them
- Required vs. optional fields are not distinguished visually
- Event form fields are ungrouped — a long undifferentiated list of ~15 inputs
- End Date always shows even when Start Date is empty
- Auth card widths are inconsistent (420 / 440 / 480px across pages)
- Public `/submit` page is missing Event Type chips and Flyer upload that the partner form has

---

## Approach: Shared Hook + Specialized Components

Extract the two hardest problems (validation lifecycle, phone formatting) into reusable pieces. Fix aria/labels/sections in-place across all forms. No full form rewrite.

---

## Section 1: `useField` Hook

**File:** `stemApp/app/hooks/useField.js`

A single hook that manages form state, touched tracking, and Zod validation for any form.

**Behavior:**
- Before touch: no error shown (field is pristine)
- On blur: mark field as touched, run Zod validation, show error if invalid
- On change after touch: re-validate immediately (live feedback)
- On submit: mark all fields touched + validate all at once (catches untouched required fields)

**API:**
```js
const { values, errors, touched, handleChange, handleBlur, handleSubmit } = useField(schema, initialValues, onSubmit);
```

Every form replaces its existing `useState` + manual `handleChange` with this hook. No per-form custom validation logic needed.

**Affected forms:**
- `LogIn.js`
- `signup/page.js`
- `RegisterForm.js`
- `forgot-password/page.js`
- `reset-password/page.js`
- `EventSubmissionForm.js`
- `submit/page.js`

---

## Section 2: Input Components

**Files:** `stemApp/app/components/PhoneField.js`, updates to password fields

### PhoneField
- Thin wrapper around MUI `TextField`
- Auto-strips non-digits from input value (stores raw 10 digits in state)
- Displays formatted as `(203) 555-1212` while typing
- Passes through all standard TextField props (error, helperText, aria attributes)
- Used in: `RegisterForm.js`, `submit/page.js`

### Password Show/Hide Toggle
- Add MUI `InputAdornment` with eye icon to all password `TextField` instances
- Toggles `type="password"` / `type="text"`
- Used in: `LogIn.js`, `signup/page.js`, `RegisterForm.js`, `reset-password/page.js`

---

## Section 3: Accessibility Fixes

Applied to every `TextField` and `FormControl` across all forms:

- `inputProps={{ 'aria-describedby': \`${name}-helper-text\`, 'aria-required': required }}`
- `FormHelperTextProps={{ id: \`${name}-helper-text\` }}`
- Optional fields get `"(optional)"` appended to label text:
  - Event form: `audience`, `cost`, `hyperlink`, `event_contact`, `end_datetime`
- Auth card widths unified to `maxWidth: 420` across: login, signup, register, forgot-password, reset-password

---

## Section 4: Event Form Restructure

Applied to both `EventSubmissionForm.js` and `submit/page.js`.

### Section Grouping
Fields split into named sections with MUI `Divider` + `Typography` section header:

1. **Event Basics** — Title, Description, Event Type (chips)
2. **Date & Time** — Start Date & Time, End Date & Time
3. **Location** — Address, City, County
4. **Details** *(all optional)* — Audience, Cost, Event Link, Event Contact Email
5. **Flyer** — drag-and-drop upload

The public submit form (`submit/page.js`) has an additional section at the top:
- **Your Contact Information** — Your Name, Your Email, Your Phone

### End Date Conditional
End Date & Time only renders once Start Date & Time has a value:
```jsx
{values.start_datetime && <PhoneField ... />}
```
No animation — field appears cleanly when start date is set.

### Public Form Parity
`submit/page.js` gets:
- Event Type chip selector (same as `EventSubmissionForm.js`)
- Flyer drag-and-drop upload (same `FlyerUpload` component, extracted to shared location)

`FlyerUpload` moved from inline in `EventSubmissionForm.js` to `stemApp/app/components/FlyerUpload.js` so both forms can import it.

---

## Files Changed

| File | Change |
|------|--------|
| `app/hooks/useField.js` | New — validation hook |
| `app/components/PhoneField.js` | New — formatted phone input |
| `app/components/FlyerUpload.js` | Extracted from EventSubmissionForm |
| `app/components/EventSubmissionForm.js` | useField hook, section grouping, aria fixes |
| `app/submit/page.js` | useField hook, section grouping, event type + flyer, aria fixes |
| `app/components/LogIn.js` | useField hook, show/hide password, aria fixes, card width |
| `app/signup/page.js` | useField hook, show/hide password, aria fixes, card width |
| `app/components/RegisterForm.js` | useField hook, PhoneField, show/hide password, aria fixes, card width |
| `app/forgot-password/page.js` | useField hook, aria fixes, card width |
| `app/reset-password/page.js` | useField hook, show/hide password, aria fixes, card width |

---

## Out of Scope

- Backend validation changes
- Full form consolidation (submit/page.js and EventSubmissionForm.js remain separate files)
- New fields or schema changes
- Admin dashboard forms
