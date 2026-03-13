'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import Toast from '../components/Toast';
import { useToast } from '@/hooks/useToast';
import { apiUrl } from '@/lib/api';
import { formatFullName } from '@/lib/utils';
import {
  Box, Stack, Grid, Card, CardActionArea, CardContent, TextField,
  Typography, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';

const STATUS_CHIP = {
  active:   { label: 'Active',   color: 'success' },
  pending:  { label: 'Pending',  color: 'warning' },
  disabled: { label: 'Disabled', color: 'error'   },
};

const STAT_CARDS = [
  { filterValue: 'all',      label: 'Total',    key: 'total',    color: 'primary.dark' },
  { filterValue: 'pending',  label: 'Pending',  key: 'pending',  color: 'warning.dark' },
  { filterValue: 'active',   label: 'Active',   key: 'active',   color: 'success.dark' },
  { filterValue: 'disabled', label: 'Disabled', key: 'disabled', color: 'error.dark'   },
];

export default function PartnersTable({ organizations: initialOrganizations }) {
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [loadingId, setLoadingId]         = useState(null);
  const { toasts, addToast, dismissToast } = useToast();

  const stats = {
    total:    organizations.length,
    active:   organizations.filter(o => o.status === 'active').length,
    pending:  organizations.filter(o => o.status === 'pending').length,
    disabled: organizations.filter(o => o.status === 'disabled').length,
  };

  const filtered = organizations.filter(org => {
    const q = search.toLowerCase();
    const contactName = formatFullName(org.contact_first_name, org.contact_last_name).toLowerCase();
    const matchSearch = org.org_name.toLowerCase().includes(q)
      || contactName.includes(q)
      || org.contact_email.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || org.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const updateStatus = useCallback(async (orgId, orgName, status) => {
    setLoadingId(orgId);
    try {
      const res = await fetch(apiUrl(`/api/organizations/${orgId}/status`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setOrganizations(prev => prev.map(o => o.org_id === orgId ? { ...o, status } : o));
        addToast(`${orgName} has been set to ${status}.`, 'success');
      } else {
        addToast('Error: ' + data.message, 'error');
      }
    } catch {
      addToast('Network error. Please try again.', 'error');
    } finally {
      setLoadingId(null);
    }
  }, []);

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STAT_CARDS.map(({ filterValue, label, key, color }) => {
          const isActive = statusFilter === filterValue;
          return (
            <Grid item xs={6} sm={3} key={key}>
              <Card elevation={isActive ? 4 : 1} sx={{ border: isActive ? 2 : 1, borderColor: isActive ? color : 'divider' }}>
                <CardActionArea
                  onClick={() => setStatusFilter(filterValue)}
                  aria-pressed={isActive}
                  sx={{ p: 2, textAlign: 'center' }}
                >
                  <CardContent sx={{ p: 0 }}>
                    <Typography variant="h4" fontWeight={700} color={color}>{stats[key]}</Typography>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Organization, contact name, or email…"
          label="Search"
          sx={{ minWidth: 280 }}
          inputProps={{ 'aria-label': 'Search by organization name, contact name, or email' }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }} aria-live="polite" aria-atomic="true">
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </Typography>
      </Stack>

      <TableContainer component={Paper} elevation={1}>
        <Table size="small" aria-label="Partner organizations">
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.dark' }}>
              {['Organization', 'Contact Name', 'Contact Email', 'Phone', 'Events', 'Status', 'Actions'].map(h => (
                <TableCell key={h} sx={{ color: 'white', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(org => {
              const isLoading = loadingId === org.org_id;
              const chipProps = STATUS_CHIP[org.status] ?? { label: org.status, color: 'default' };
              return (
                <TableRow key={org.org_id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} component={Link} href={`/partners/${org.org_id}`}
                      sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      {org.org_name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatFullName(org.contact_first_name, org.contact_last_name)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" component="a" href={`mailto:${org.contact_email}`}
                      aria-label={`Email ${org.org_name} at ${org.contact_email}`}
                      sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      {org.contact_email}
                    </Typography>
                  </TableCell>
                  <TableCell><Typography variant="body2">{org.contact_phone || '—'}</Typography></TableCell>
                  <TableCell>
                    {org.event_count > 0 ? (
                      <Box>
                        <Typography variant="body2">{org.event_count} total</Typography>
                        {org.pending_count > 0 && (
                          <Typography variant="caption" color="warning.dark">{org.pending_count} pending</Typography>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={chipProps.label} color={chipProps.color} size="small" />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {org.status === 'pending' && (
                      <Button size="small" variant="contained" color="success" disabled={isLoading}
                        onClick={() => updateStatus(org.org_id, org.org_name, 'active')}
                        aria-label={`Activate ${org.org_name}`}>
                        Activate
                      </Button>
                    )}
                    {org.status === 'active' && (
                      <Button size="small" variant="contained" color="error" disabled={isLoading}
                        onClick={() => updateStatus(org.org_id, org.org_name, 'disabled')}
                        aria-label={`Disable ${org.org_name}`}>
                        Disable
                      </Button>
                    )}
                    {org.status === 'disabled' && (
                      <Button size="small" variant="outlined" disabled={isLoading}
                        onClick={() => updateStatus(org.org_id, org.org_name, 'pending')}
                        aria-label={`Set ${org.org_name} back to pending`}>
                        Set Pending
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No organizations match your search.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
