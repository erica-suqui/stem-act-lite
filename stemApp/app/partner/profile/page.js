'use client';

import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Alert, Stack, Chip, CircularProgress,
} from '@mui/material';
import { apiUrl } from '@/lib/api';
import { getStoredItem } from '@/lib/storage';

export default function PartnerProfilePage() {
  const [orgStatus, setOrgStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [codeStatus, setCodeStatus] = useState(null); // null | 'valid' | 'invalid'
  const [codeMessage, setCodeMessage] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  const orgId = typeof window !== 'undefined' ? getStoredItem('orgId') : null;

  useEffect(() => {
    if (!orgId) return;
    fetch(apiUrl(`/api/organizations/${orgId}`))
      .then(r => r.json())
      .then(data => {
        if (data.success) setOrgStatus(data.organization.status);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  const handleCodeBlur = async () => {
    const trimmed = code.trim();
    if (!trimmed) { setCodeStatus(null); return; }
    const res = await fetch(apiUrl(`/api/partner-codes/validate?code=${encodeURIComponent(trimmed)}`));
    const data = await res.json();
    if (data.valid) { setCodeStatus('valid'); setCodeMessage(''); }
    else { setCodeStatus('invalid'); setCodeMessage(data.message || 'Invalid code'); }
  };

  const handleRedeem = async () => {
    setRedeemError('');
    const res = await fetch(apiUrl('/api/partner-codes/redeem'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase(), org_id: Number(orgId) }),
    });
    const data = await res.json();
    if (data.success) {
      setRedeemSuccess(true);
      setOrgStatus('active');
    } else {
      setRedeemError(data.error || 'Failed to redeem code');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 3, maxWidth: 520 }}>
      <Typography variant="h5" fontWeight={700} color="primary.dark" gutterBottom>
        Account Status
      </Typography>

      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body1">Organization status:</Typography>
            <Chip
              label={orgStatus === 'active' ? 'Active' : 'Pending Review'}
              color={orgStatus === 'active' ? 'success' : 'warning'}
            />
          </Stack>
        </CardContent>
      </Card>

      {orgStatus !== 'active' && !redeemSuccess && (
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Activate with Access Code</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter a partner access code to get your organization approved immediately.
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Access Code"
                value={code}
                onChange={e => { setCode(e.target.value); setCodeStatus(null); }}
                onBlur={handleCodeBlur}
                fullWidth
                inputProps={{ style: { textTransform: 'uppercase' } }}
                error={codeStatus === 'invalid'}
                color={codeStatus === 'valid' ? 'success' : undefined}
                helperText={
                  codeStatus === 'valid' ? '✓ Valid code' :
                  codeStatus === 'invalid' ? codeMessage : ''
                }
              />
              {redeemError && <Alert severity="error">{redeemError}</Alert>}
              <Button
                variant="contained"
                onClick={handleRedeem}
                disabled={codeStatus !== 'valid'}
              >
                Activate Account
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {redeemSuccess && (
        <Alert severity="success">Your organization has been activated!</Alert>
      )}
    </Box>
  );
}
