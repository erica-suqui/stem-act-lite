'use client';

import React, { useState, useCallback, useMemo } from 'react';
import DenyModal from './DenyModal';
import ApproveModal from './ApproveModal';
import RevokeModal from './RevokeModal';
import StatsCards from './StatsCards';
import Toast from './Toast';
import EventSubmissionForm from './EventSubmissionForm';
import { useToast } from '@/hooks/useToast';
import { formatDate, formatCost, formatTimeRange } from '@/lib/utils';
import { apiUrl } from '@/lib/api';
import {
  Box, Stack, Tabs, Tab, TextField, Select, MenuItem, FormControl,
  InputLabel, Typography, Badge, Chip, Button, Collapse,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';

const STATUS_CHIP = {
  pending:  { label: 'Pending',  color: 'warning' },
  approved: { label: 'Approved', color: 'success' },
  denied:   { label: 'Denied',   color: 'error'   },
};

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

  const stats = useMemo(() => ({
    pending:  events.filter(e => e.status === 'pending').length,
    approved: events.filter(e => e.status === 'approved').length,
    denied:   events.filter(e => e.status === 'denied').length,
    total:    events.length,
  }), [events]);

  const tabEvents = isPartnerTab ? partnerEvents : viewerEvents;

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

  return (
    <>
      <StatsCards stats={stats} onFilter={setStatusFilter} activeFilter={statusFilter} />

      <Tabs value={activeTab} onChange={switchTab} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab
          label={
            <Badge badgeContent={activeTab === 1 ? partnerPending : 0} color="warning" sx={{ pr: partnerPending && activeTab === 1 ? 2 : 0 }}>
              Partner Events
            </Badge>
          }
        />
        <Tab
          label={
            <Badge badgeContent={activeTab === 0 ? viewerPending : 0} color="warning" sx={{ pr: viewerPending && activeTab === 0 ? 2 : 0 }}>
              Viewer Events
            </Badge>
          }
        />
      </Tabs>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by title or tag…"
          label="Search"
          sx={{ minWidth: 200 }}
          inputProps={{ 'aria-label': 'Search events by title or tag' }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="status-filter-label">Status</InputLabel>
          <Select
            labelId="status-filter-label"
            value={statusFilter}
            label="Status"
            onChange={e => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="denied">Denied</MenuItem>
          </Select>
        </FormControl>
        {isPartnerTab && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="org-filter-label">Organization</InputLabel>
            <Select
              labelId="org-filter-label"
              value={orgFilter}
              label="Organization"
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
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }} aria-live="polite" aria-atomic="true">
          {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
        </Typography>
        <Button variant="contained" size="small" onClick={() => setAddEventOpen(true)}>
          + Add Event
        </Button>
      </Stack>

      <TableContainer component={Paper} elevation={1}>
        <Table size="small" aria-label={`${isPartnerTab ? 'Partner' : 'Viewer'} event submissions`}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.dark' }}>
              {['Event Title', isPartnerTab ? 'Organization' : 'Submitted By', 'Date', 'Time', 'Location', 'Audience', 'Tags', 'Cost', 'Status', 'Submitted', 'Actions'].map(h => (
                <TableCell key={h} sx={{ color: 'white', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(event => {
              const isLoading  = loadingId === event.event_id;
              const chipProps  = STATUS_CHIP[event.status] ?? { label: event.status, color: 'default' };
              const isExpanded = expandedId === event.event_id;
              return (
                <React.Fragment key={event.event_id}>
                  <TableRow hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{event.title}</Typography>
                      {event.hyperlink && (
                        <Typography variant="caption">
                          <a href={event.hyperlink} target="_blank" rel="noopener noreferrer"
                            aria-label={`${event.title} — external event link`}>
                            Event Link
                          </a>
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {isPartnerTab ? event.org_name : (event.submitter_name ?? <em>Unknown</em>)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{event.event_contact}</Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">{formatDate(event.start_datetime)}</Typography>
                      {event.end_datetime && formatDate(event.end_datetime) !== formatDate(event.start_datetime) && (
                        <Typography variant="caption" color="text.secondary">to {formatDate(event.end_datetime)}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">{formatTimeRange(event.start_datetime, event.end_datetime)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{event.city}, {event.county}</Typography>
                      <Typography variant="caption" color="text.secondary">{event.address}</Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2">{event.audience}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2">{event.tag_names?.length ? event.tag_names.join(', ') : '—'}</Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2">{formatCost(event.cost)}</Typography></TableCell>
                    <TableCell>
                      <Chip label={chipProps.label} color={chipProps.color} size="small" />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2">{formatDate(event.created_at)}</Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Stack direction="row" spacing={0.5}>
                        {event.status === 'pending' && (
                          <>
                            <Button size="small" variant="contained" color="success" disabled={isLoading}
                              onClick={() => setApproveTarget(event)} aria-label={`Approve: ${event.title}`}>
                              Approve
                            </Button>
                            <Button size="small" variant="contained" color="error" disabled={isLoading}
                              onClick={() => setDenyTarget(event)} aria-label={`Deny: ${event.title}`}>
                              Deny
                            </Button>
                          </>
                        )}
                        {event.status === 'approved' && (
                          <Button size="small" variant="outlined" color="error" disabled={isLoading}
                            onClick={() => setRevokeTarget(event)} aria-label={`Revoke: ${event.title}`}>
                            Revoke
                          </Button>
                        )}
                        {event.status === 'denied' && (
                          <Button size="small" variant="contained" color="success" disabled={isLoading}
                            onClick={() => setApproveTarget(event)} aria-label={`Approve: ${event.title}`}>
                            Approve
                          </Button>
                        )}
                        <Button size="small" variant="text"
                          onClick={() => setExpandedId(isExpanded ? null : event.event_id)}
                          aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Hide' : 'Show'} details: ${event.title}`}>
                          {isExpanded ? 'Hide' : 'Details'}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={11} sx={{ pb: 0, pt: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Description</Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>{event.description}</Typography>
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
                <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
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
