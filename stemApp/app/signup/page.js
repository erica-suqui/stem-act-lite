'use client';

import React, { useState } from 'react';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Alert, Stack,
} from '@mui/material';
import Link from 'next/link';

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

export default function SignUpPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const result = signupSchema.safeParse(formData);
    if (!result.success) {
      setErrors(result.error.format());
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/register/public'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
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
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', bgcolor: 'background.default', px: 2, py: 4,
    }}>
      <Card elevation={4} sx={{ width: '100%', maxWidth: 440, p: 2 }}>
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
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  fullWidth
                  required
                  error={Boolean(errors.firstName)}
                  helperText={errors.firstName?._errors?.[0]}
                />
                <TextField
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  fullWidth
                  required
                  error={Boolean(errors.lastName)}
                  helperText={errors.lastName?._errors?.[0]}
                />
              </Stack>
              <TextField
                label="Email"
                name="email"
                type="email"
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
              <TextField
                label="Confirm Password"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                fullWidth
                required
                error={Boolean(errors.confirmPassword)}
                helperText={errors.confirmPassword?._errors?.[0]}
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
