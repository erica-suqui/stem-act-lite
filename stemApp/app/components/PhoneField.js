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
