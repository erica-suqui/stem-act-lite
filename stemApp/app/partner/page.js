'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { apiUrl } from '@/lib/api';
import EventSubmissionForm from '@/app/components/EventSubmissionForm';
import Toast from '@/app/components/Toast';

const STATUS_CONFIG = {
  pending:  { color: 'warning',  label: 'Pending' },
  approved: { color: 'success',  label: 'Approved' },
  denied:   { color: 'error',    label: 'Denied' },
};

export default function PartnerDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    setToasts(prev => [...prev, { id: Date.now(), message, type }]);
  };

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;
  const userId = typeof window !== 'undefined' ? localStorage.getItem('userID') : null;

  const fetchEvents = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/events?org_id=${orgId}`));
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = await res.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (err) {
      addToast('Failed to load events.', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleSubmitNew = async (formData) => {
    if (!orgId || !userId) {
      addToast('Session expired. Please log in again.', 'error');
      return { success: false, message: 'Not authenticated' };
    }
    try {
      const res = await fetch(apiUrl('/api/events'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          org_id: Number(orgId),
          submitted_by_user_id: Number(userId),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(err.detail || 'Failed to submit event.', 'error');
        return { success: false, message: err.detail || 'Failed to submit event.' };
      }
      addToast('Event submitted successfully!', 'success');
      setSubmitOpen(false);
      fetchEvents();
      return { success: true };
    } catch (err) {
      addToast('An unexpected error occurred.', 'error');
      return { success: false, message: 'An unexpected error occurred.' };
    }
  };

  const handleEditSubmit = async (formData) => {
    if (!editEvent) return;
    try {
      const res = await fetch(apiUrl(`/api/events/${editEvent.event_id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(err.detail || 'Failed to update event.', 'error');
        return { success: false, message: err.detail || 'Failed to update event.' };
      }
      addToast('Event updated successfully!', 'success');
      setEditEvent(null);
      fetchEvents();
      return { success: true };
    } catch (err) {
      addToast('An unexpected error occurred.', 'error');
      return { success: false, message: 'An unexpected error occurred.' };
    }
  };

  const canEdit = (event) => event.status === 'pending' || event.status === 'denied';

  return (
    <Box sx={{ p: 3 }}>
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">My Events</Typography>
        <Button variant="contained" onClick={() => setSubmitOpen(true)}>
          + Submit New Event
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : events.length === 0 ? (
        <Typography>No events submitted yet.</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Admin Comment</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => {
                const statusCfg = STATUS_CONFIG[event.status] || { color: 'default', label: event.status };
                return (
                  <TableRow key={event.event_id}>
                    <TableCell>{event.title}</TableCell>
                    <TableCell>
                      {event.start_datetime
                        ? new Date(event.start_datetime).toLocaleString()
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={statusCfg.label}
                        color={statusCfg.color}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{event.admin_comment || '—'}</TableCell>
                    <TableCell>
                      {canEdit(event) && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setEditEvent(event)}
                        >
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Submit New Event Dialog */}
      <Dialog open={submitOpen} onClose={() => setSubmitOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Submit New Event</DialogTitle>
        <DialogContent>
          <EventSubmissionForm
            onSubmit={handleSubmitNew}
            submitLabel="Submit Event"
            onCancel={() => setSubmitOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={Boolean(editEvent)} onClose={() => setEditEvent(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Event</DialogTitle>
        <DialogContent>
          {editEvent && (
            <EventSubmissionForm
              initialData={editEvent}
              onSubmit={handleEditSubmit}
              submitLabel="Save Changes"
              onCancel={() => setEditEvent(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
