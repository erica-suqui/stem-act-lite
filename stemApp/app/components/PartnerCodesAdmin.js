'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Chip, MenuItem, Select, FormControl,
  InputLabel, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Typography, Alert, TextField,
} from '@mui/material';
import { apiUrl } from '@/lib/api';

const STATUS_COLOR = { active: 'success', used: 'default', expired: 'error', revoked: 'warning' };

export default function PartnerCodesAdmin() {
  const [codes, setCodes] = useState([]);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [newCode, setNewCode] = useState(null);
  const [generateError, setGenerateError] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [createOrgError, setCreateOrgError] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  const fetchCodes = useCallback(async () => {
    const res = await fetch(apiUrl('/api/partner-codes'));
    const data = await res.json();
    if (data.success) setCodes(data.codes);
  }, []);

  const fetchOrgs = useCallback(async () => {
    const res = await fetch(apiUrl('/api/organizations'));
    const data = await res.json();
    if (data.success) setOrgs(data.organizations);
  }, []);

  useEffect(() => { fetchCodes(); fetchOrgs(); }, [fetchCodes, fetchOrgs]);

  const handleCreateOrg = async () => {
    setCreateOrgError('');
    setCreatingOrg(true);
    const res = await fetch(apiUrl('/api/organizations'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_name: newOrgName.trim() }),
    });
    const data = await res.json();
    setCreatingOrg(false);
    if (data.success) {
      setNewOrgName('');
      fetchOrgs();
    } else {
      setCreateOrgError(data.error || 'Failed to create organization');
    }
  };

  const handleGenerate = async () => {
    setGenerateError('');
    setNewCode(null);
    const res = await fetch(apiUrl('/api/partner-codes/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expires_in_days: expiresInDays, org_id: selectedOrgId || null }),
    });
    const data = await res.json();
    if (data.success) { setNewCode(data.code); fetchCodes(); }
    else setGenerateError(data.error || 'Failed to generate code');
  };

  const handleRevoke = async (codeId) => {
    const res = await fetch(apiUrl(`/api/partner-codes/${codeId}/revoke`), { method: 'POST' });
    const data = await res.json();
    if (data.success) fetchCodes();
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>Partner Access Codes</Typography>

      {/* Create org */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>Create Organization</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            size="small"
            label="Organization Name"
            value={newOrgName}
            onChange={e => setNewOrgName(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Button variant="outlined" onClick={handleCreateOrg} disabled={!newOrgName.trim() || creatingOrg}>
            {creatingOrg ? 'Creating…' : 'Create Org'}
          </Button>
        </Stack>
        {createOrgError && <Alert severity="error" sx={{ mt: 1 }}>{createOrgError}</Alert>}
      </Paper>

      {/* Generate code */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Expires in</InputLabel>
          <Select value={expiresInDays} label="Expires in" onChange={e => setExpiresInDays(e.target.value)}>
            <MenuItem value={1}>1 day</MenuItem>
            <MenuItem value={7}>7 days</MenuItem>
            <MenuItem value={30}>30 days</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Link to org (optional)</InputLabel>
          <Select
            value={selectedOrgId}
            label="Link to org (optional)"
            onChange={e => setSelectedOrgId(e.target.value)}
          >
            <MenuItem value=''>— No org (general use) —</MenuItem>
            {orgs.map(o => (
              <MenuItem key={o.org_id} value={o.org_id}>{o.org_name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" onClick={handleGenerate}>Generate Code</Button>
      </Stack>

      {newCode && (
        <Alert severity="success" sx={{ mb: 2 }}>
          New code: <strong>{newCode}</strong> — share this with the partner.
        </Alert>
      )}
      {generateError && <Alert severity="error" sx={{ mb: 2 }}>{generateError}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell>For Org</TableCell>
              <TableCell>Used by</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {codes.length === 0 && (
              <TableRow><TableCell colSpan={6}>No codes yet.</TableCell></TableRow>
            )}
            {codes.map(c => (
              <TableRow key={c.code_id}>
                <TableCell><strong>{c.code}</strong></TableCell>
                <TableCell>
                  <Chip label={c.status} color={STATUS_COLOR[c.status] || 'default'} size="small" />
                </TableCell>
                <TableCell>{new Date(c.expires_at).toLocaleDateString()}</TableCell>
                <TableCell>{c.org_name || '—'}</TableCell>
                <TableCell>{c.consumed_by_org || '—'}</TableCell>
                <TableCell>
                  {c.status === 'active' && (
                    <Button size="small" color="error" onClick={() => handleRevoke(c.code_id)}>
                      Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
