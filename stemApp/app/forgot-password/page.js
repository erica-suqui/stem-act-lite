'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Alert, Stack,
} from '@mui/material';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
      <Card elevation={4} sx={{ width: '100%', maxWidth: 420, p: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} color="primary.dark" gutterBottom>
            Reset Password
          </Typography>

          {submitted ? (
            <Alert severity="success">
              If that email is registered, a reset link has been sent. Check the server logs if you&apos;re in development.
            </Alert>
          ) : (
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </Typography>
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                />
                <Button type="submit" variant="contained" fullWidth disabled={loading || !email}>
                  Send Reset Link
                </Button>
                <Typography variant="body2" align="center" color="text.secondary">
                  <Link href="/login" style={{ color: 'inherit' }}>Back to sign in</Link>
                </Typography>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
