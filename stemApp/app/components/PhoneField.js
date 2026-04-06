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
    // Note: editing mid-string jumps cursor to end — known limitation of controlled format inputs.
    if (onChange) onChange({ target: { name, value: raw } });
  };

  return (
    <TextField
      {...props}
      name={name}
      value={formatPhone(value)}
      onChange={handleChange}
      slotProps={{
        ...props.slotProps,
        input: {
          ...props.slotProps?.input,
          inputMode: 'numeric',
          // Only link aria-describedby when helperText exists; otherwise the id has no DOM target.
          'aria-describedby': props.helperText ? `${name}-helper-text` : undefined,
          'aria-required': props.required ? true : undefined,
        },
        formHelperText: props.helperText ? { id: `${name}-helper-text` } : undefined,
      }}
    />
  );
}
