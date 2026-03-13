'use client';

import React, { useState, useCallback, useMemo } from 'react';
import DenyModal from './DenyModal';
import ApproveModal from './ApproveModal';
import RevokeModal from './RevokeModal';
import Toast from './Toast';
import EventSubmissionForm from './EventSubmissionForm';
import { useToast } from '@/hooks/useToast';
import { formatDate, formatCost, formatTimeRange } from '@/lib/utils';
import { apiUrl } from '@/lib/api';
import {
  Box, Stack, Tabs, Tab, TextField, Select, MenuItem, FormControl,
  InputLabel, Typography, Chip, Button, Collapse,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Dialog, DialogTitle, DialogContent,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';

export default function EventsTable({ events: initialEvents, organizations }) {
  const [events, setEvents]               = useState(initialEvents);
  const [activeTab, setActiveTab]         = useState(0); // 0=partner, 1=viewer
  const [statusFilter, setStatusFilter]   = useState('all');
  const [orgFilter, setOrgFilter]         = useState('all');
  const [search, setSearch]               = useState('');
  const [expandedId, setExpandedId]       = useState(null);
  const [denyTarget, setDenyTarget]       = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [revokeTarget, setRevokeTarget]   = useState(null);
  const [loadingId, setLoadingId]         = useState(null);
  const [addEventOpen, setAddEventOpen]   = useState(false);
  const { toasts, addToast, dismissToast } = useToast();

  const isPartnerTab = activeTab === 0;

  const partnerEvents = useMemo(() => events.filter(e => e.org_id != null), [events]);
  const viewerEvents  = useMemo(() => events.filter(e => e.org_id == null), [events]);

  const partnerPending = useMemo(() => partnerEvents.filter(e => e.status === 'pending').length, [partnerEvents]);
  const viewerPending  = useMemo(() => viewerEvents.filter(e => e.status === 'pending').length, [viewerEvents]);

  const tabEvents = isPartnerTab ? partnerEvents : viewerEvents;

  const tabCounts = useMemo(() => ({
    all:      tabEvents.length,
    pending:  tabEvents.filter(e => e.status === 'pending').length,
    approved: tabEvents.filter(e => e.status === 'approved').length,
    denied:   tabEvents.filter(e => e.status === 'denied').length,
  }), [tabEvents]);

  const filtered = tabEvents.filter(e => {
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchOrg    = !isPartnerTab || orgFilter === 'all' || String(e.org_id) === orgFilter;
    const query = search.toLowerCase();
    const tagNames = Array.isArray(e.tag_names) ? e.tag_names : [];
    const matchSearch = search === ''
      || e.title.toLowerCase().includes(query)
      || tagNames.some(tag => tag.toLowerCase().includes(query));
    return matchStatus && matchOrg && matchSearch;
  });

  function switchTab(_, newValue) {
    setActiveTab(newValue);
    setStatusFilter('all');
    setOrgFilter('all');
    setSearch('');
    setExpandedId(null);
  }

  function updateEvent(eventId, patch) {
    setEvents(prev => prev.map(e => e.event_id === eventId ? { ...e, ...patch } : e));
  }

  const handleApprove = useCallback(async (eventId, title) => {
    setLoadingId(eventId);
    setApproveTarget(null);
    try {
      const res  = await fetch(apiUrl(`/api/events/${eventId}/approve`), { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        updateEvent(eventId, { status: 'approved', admin_comment: null });
        addToast(`"${title}" has been approved and published.`, 'success');
      } else {
        addToast('Error: ' + data.message, 'error');
      }
    } catch {
      addToast('Network error. Please try again.', 'error');
    } finally {
      setLoadingId(null);
    }
  }, []);

  const handleDeny = useCallback(async (eventId, title, comment) => {
    setLoadingId(eventId);
    setDenyTarget(null);
    try {
      const res  = await fetch(apiUrl(`/api/events/${eventId}/deny`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });
      const data = await res.json();
      if (data.success) {
        updateEvent(eventId, { status: 'denied', admin_comment: comment });
        addToast(`"${title}" has been denied.`, 'error');
      } else {
        addToast('Error: ' + data.message, 'error');
      }
    } catch {
      addToast('Network error. Please try again.', 'error');
    } finally {
      setLoadingId(null);
    }
  }, []);

  const handleRevoke = useCallback(async (eventId, title) => {
    setLoadingId(eventId);
    setRevokeTarget(null);
    try {
      const res  = await fetch(apiUrl(`/api/events/${eventId}/revoke`), { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        updateEvent(eventId, { status: 'pending', admin_comment: null });
        addToast(`"${title}" has been revoked and returned to pending.`, 'success');
      } else {
        addToast('Error: ' + data.message, 'error');
      }
    } catch {
      addToast('Network error. Please try again.', 'error');
    } finally {
      setLoadingId(null);
    }
  }, []);

  const handleAdminAddEvent = useCallback(async (formData) => {
    try {
      const submitRes = await fetch(apiUrl('/api/events'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, submitter_name: 'Admin', submitter_email: 'admin' }),
      });
      const submitData = await submitRes.json();
      if (!submitData.success) return { success: false, message: submitData.message };

      const eventId = submitData.event_id;
      const approveRes = await fetch(apiUrl(`/api/events/${eventId}/approve`), { method: 'POST' });
      const approveData = await approveRes.json();
      if (!approveData.success) return { success: false, message: 'Event created but approval failed.' };

      setEvents(prev => [{
        event_id: eventId,
        ...formData,
        org_id: null,
        submitter_name: 'Admin',
        status: 'approved',
        admin_comment: null,
        created_at: new Date().toISOString(),
        tag_names: [],
      }, ...prev]);
      setAddEventOpen(false);
      addToast(`"${formData.title}" created and published.`, 'success');
      return { success: true };
    } catch {
      return { success: false, message: 'Network error. Please try again.' };
    }
  }, [addToast]);

  const STATUS_PILLS = [
    { key: 'all',      label: 'All',      color: 'default' },
    { key: 'pending',  label: 'Pending',  color: 'warning' },
    { key: 'approved', label: 'Approved', color: 'success' },
    { key: 'denied',   label: 'Denied',   color: 'error'   },
  ];

  return (
    <>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h6" fontWeight={700}>Event Submissions</Typography>
          <Chip
            label={`${events.length} total`}
            size="small"
            sx={{ borderRadius: 1, fontWeight: 500 }}
          />
        </Stack>
        <Button variant="contained" size="small" onClick={() => setAddEventOpen(true)}>
          + Add Event
        </Button>
      </Stack>

      {/* Status pill filters */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
        {STATUS_PILLS.map(({ key, label, color }) => {
          const active = statusFilter === key;
          return (
            <Chip
              key={key}
              label={`${label} ${tabCounts[key]}`}
              color={active ? color : 'default'}
              variant={active ? 'filled' : 'outlined'}
              onClick={() => setStatusFilter(key)}
              clickable
              size="small"
              sx={{ borderRadius: 4, fontWeight: active ? 600 : 400, px: 0.5 }}
            />
          );
        })}
      </Stack>

      {/* Partner / Viewer tabs */}
      <Tabs value={activeTab} onChange={switchTab} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab
          label={
            <Box component="span">
              Partner Events
              {partnerPending > 0 && activeTab === 1 && (
                <Chip label={partnerPending} color="warning" size="small" sx={{ ml: 1, height: 18, fontSize: 11 }} />
              )}
            </Box>
          }
        />
        <Tab
          label={
            <Box component="span">
              Viewer Events
              {viewerPending > 0 && activeTab === 0 && (
                <Chip label={viewerPending} color="warning" size="small" sx={{ ml: 1, height: 18, fontSize: 11 }} />
              )}
            </Box>
          }
        />
      </Tabs>

      {/* Filter row */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        {isPartnerTab && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="org-filter-label">All organizations</InputLabel>
            <Select
              labelId="org-filter-label"
              value={orgFilter}
              label="All organizations"
              onChange={e => setOrgFilter(e.target.value)}
            >
              <MenuItem value="all">All organizations</MenuItem>
              {organizations.map(org => (
                <MenuItem key={org.org_id} value={String(org.org_id)}>
                  {org.org_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
        </Typography>
        <TextField
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by title or tag…"
          sx={{ minWidth: 220 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
            htmlInput: { 'aria-label': 'Search events by title or tag' },
          }}
        />
      </Stack>

      {/* Table */}
      <TableContainer component={Paper} elevation={0} variant="outlined">
        <Table size="small" aria-label={`${isPartnerTab ? 'Partner' : 'Viewer'} event submissions`}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {['EVENT', 'DATE & TIME', 'LOCATION', 'AUDIENCE', 'COST', 'SUBMITTED', 'ACTIONS'].map(h => (
                <TableCell
                  key={h}
                  sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary', letterSpacing: 0.5, whiteSpace: 'nowrap', py: 1.25 }}
                >
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(event => {
              const isLoading  = loadingId === event.event_id;
              const isExpanded = expandedId === event.event_id;
              const subtitle   = isPartnerTab
                ? `${event.org_name ?? '—'} · Partner`
                : (event.submitter_name ?? 'Public');

              return (
                <React.Fragment key={event.event_id}>
                  <TableRow hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    {/* EVENT */}
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{event.title}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>{subtitle}</Typography>
                      {event.hyperlink && (
                        <Typography variant="caption" display="block">
                          <a href={event.hyperlink} target="_blank" rel="noopener noreferrer"
                            aria-label={`${event.title} — external link`}>
                            Event Link
                          </a>
                        </Typography>
                      )}
                    </TableCell>

                    {/* DATE & TIME */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">{formatDate(event.start_datetime)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTimeRange(event.start_datetime, event.end_datetime)}
                      </Typography>
                    </TableCell>

                    {/* LOCATION */}
                    <TableCell>
                      <Typography variant="body2">{event.city}, {event.county}</Typography>
                      <Typography variant="caption" color="text.secondary">{event.address}</Typography>
                    </TableCell>

                    {/* AUDIENCE */}
                    <TableCell>
                      <Typography variant="body2">{event.audience || '—'}</Typography>
                    </TableCell>

                    {/* COST */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">{formatCost(event.cost)}</Typography>
                    </TableCell>

                    {/* SUBMITTED */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">{formatDate(event.created_at)}</Typography>
                    </TableCell>

                    {/* ACTIONS */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {event.status === 'pending' && (
                          <>
                            <Button
                              size="small" variant="contained" color="success"
                              disabled={isLoading}
                              onClick={() => setApproveTarget(event)}
                              sx={{ borderRadius: 1, minWidth: 0, px: 1.5, py: 0.4, fontSize: '0.75rem' }}
                              aria-label={`Approve: ${event.title}`}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small" variant="outlined" color="error"
                              disabled={isLoading}
                              onClick={() => setDenyTarget(event)}
                              sx={{ borderRadius: 1, minWidth: 0, px: 1.5, py: 0.4, fontSize: '0.75rem' }}
                              aria-label={`Deny: ${event.title}`}
                            >
                              Deny
                            </Button>
                          </>
                        )}
                        {event.status === 'approved' && (
                          <Button
                            size="small" variant="outlined" color="warning"
                            disabled={isLoading}
                            onClick={() => setRevokeTarget(event)}
                            sx={{ borderRadius: 1, minWidth: 0, px: 1.5, py: 0.4, fontSize: '0.75rem' }}
                            aria-label={`Revoke: ${event.title}`}
                          >
                            Revoke
                          </Button>
                        )}
                        {event.status === 'denied' && (
                          <Button
                            size="small" variant="contained" color="success"
                            disabled={isLoading}
                            onClick={() => setApproveTarget(event)}
                            sx={{ borderRadius: 1, minWidth: 0, px: 1.5, py: 0.4, fontSize: '0.75rem' }}
                            aria-label={`Approve: ${event.title}`}
                          >
                            Approve
                          </Button>
                        )}
                        <Button
                          size="small" variant="text" color="inherit"
                          onClick={() => setExpandedId(isExpanded ? null : event.event_id)}
                          sx={{ minWidth: 0, px: 1, fontSize: '0.75rem', color: 'text.secondary' }}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Hide' : 'Show'} details: ${event.title}`}
                        >
                          {isExpanded ? 'Hide' : 'Details'}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ pb: 0, pt: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Description</Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>{event.description}</Typography>
                            {event.tag_names?.length > 0 && (
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 1 }}>
                                {event.tag_names.map(t => (
                                  <Chip key={t} label={t} size="small" variant="outlined" />
                                ))}
                              </Stack>
                            )}
                            {event.admin_comment && (
                              <>
                                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Admin Comment</Typography>
                                <Typography variant="body2" color="error.dark">{event.admin_comment}</Typography>
                              </>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}

            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                  <Typography color="text.secondary">
                    No {isPartnerTab ? 'partner' : 'viewer'} events match the selected filters.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {approveTarget && (
        <ApproveModal
          event={approveTarget}
          onApprove={() => handleApprove(approveTarget.event_id, approveTarget.title)}
          onClose={() => setApproveTarget(null)}
        />
      )}
      {denyTarget && (
        <DenyModal
          event={denyTarget}
          onDeny={(comment) => handleDeny(denyTarget.event_id, denyTarget.title, comment)}
          onClose={() => setDenyTarget(null)}
        />
      )}
      {revokeTarget && (
        <RevokeModal
          event={revokeTarget}
          onRevoke={() => handleRevoke(revokeTarget.event_id, revokeTarget.title)}
          onClose={() => setRevokeTarget(null)}
        />
      )}

      <Dialog open={addEventOpen} onClose={() => setAddEventOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Event</DialogTitle>
        <DialogContent dividers>
          <EventSubmissionForm
            onSubmit={handleAdminAddEvent}
            submitLabel="Create &amp; Publish"
            onCancel={() => setAddEventOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
