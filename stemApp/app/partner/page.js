'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { apiUrl } from '@/lib/api';
import EventSubmissionForm from '@/app/components/EventSubmissionForm';
import Toast from '@/app/components/Toast';
import SignOutButton from '@/app/components/SignOutButton';
import { getStoredItem,clearStoredAuth } from '@/lib/storage';

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

  const orgId = typeof window !== 'undefined' ? getStoredItem('orgId') : null;
  const userId = typeof window !== 'undefined' ? getStoredItem('userID') : null;

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

  const handleSubmitNew = async (formData, flyerFile) => {
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
      const data = await res.json();
      if (flyerFile && data.event_id) {
        const form = new FormData();
        form.append('file', flyerFile);
        await fetch(apiUrl(`/api/events/${data.event_id}/flyer`), {
          method: 'POST',
          body: form,
        });
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

  const handleEditSubmit = async (formData, flyerFile) => {
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
      if (flyerFile) {
        const form = new FormData();
        form.append('file', flyerFile);
        await fetch(apiUrl(`/api/events/${editEvent.event_id}/flyer`), {
          method: 'POST',
          body: form,
        });
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

  const [commentThreads, setCommentThreads] = useState({});
  const [commentInputs, setCommentInputs]   = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [sendingComment, setSendingComment] = useState(null);

  const fetchComments = useCallback(async (eventId) => {
    const res = await fetch(apiUrl(`/api/events/${eventId}/comments`));
    if (!res.ok) return;
    const data = await res.json();
    setCommentThreads(prev => ({ ...prev, [eventId]: data.comments }));
  }, []);

  const toggleComments = async (eventId) => {
    const isOpen = expandedComments[eventId];
    setExpandedComments(prev => ({ ...prev, [eventId]: !isOpen }));
    if (!isOpen && !commentThreads[eventId]) {
      await fetchComments(eventId);
    }
  };

  const handleSendComment = async (eventId) => {
    const body = (commentInputs[eventId] || '').trim();
    if (!body) return;
    setSendingComment(eventId);
    try {
      const res = await fetch(apiUrl(`/api/events/${eventId}/comments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, author_role: 'partner' }),
      });
      if (res.ok) {
        setCommentInputs(prev => ({ ...prev, [eventId]: '' }));
        await fetchComments(eventId);
        addToast('Reply sent.', 'success');
      } else {
        addToast('Failed to send reply.', 'error');
      }
    } finally {
      setSendingComment(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">My Events</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={() => setSubmitOpen(true)}>
            + Submit New Event
          </Button>
          <SignOutButton />
        </Stack>
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
                  <>
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
                        <Button
                          size="small"
                          variant="text"
                          sx={{ ml: 1 }}
                          onClick={() => toggleComments(event.event_id)}
                        >
                          {expandedComments[event.event_id] ? 'Hide Thread' : 'Comments'}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedComments[event.event_id] && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ pt: 0, pb: 1, bgcolor: 'grey.50' }}>
                          <Collapse in={expandedComments[event.event_id]}>
                            <Box sx={{ p: 1.5 }}>
                              {(commentThreads[event.event_id] || []).length === 0 ? (
                                <Typography variant="body2" color="text.secondary">No comments yet.</Typography>
                              ) : (
                                (commentThreads[event.event_id] || []).map(c => (
                                  <Box key={c.comment_id} sx={{ mb: 1, p: 1, bgcolor: c.author_role === 'admin' ? 'primary.50' : 'white', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                    <Typography variant="caption" fontWeight={600} color={c.author_role === 'admin' ? 'primary.dark' : 'text.primary'}>
                                      {c.author_role === 'admin' ? 'Admin' : 'You'}
                                    </Typography>
                                    <Typography variant="body2">{c.body}</Typography>
                                  </Box>
                                ))
                              )}
                              <Divider sx={{ my: 1 }} />
                              <Stack direction="row" spacing={1} alignItems="flex-end">
                                <TextField
                                  size="small"
                                  multiline
                                  rows={2}
                                  fullWidth
                                  placeholder="Reply to admin..."
                                  value={commentInputs[event.event_id] || ''}
                                  onChange={e => setCommentInputs(prev => ({ ...prev, [event.event_id]: e.target.value }))}
                                />
                                <Button
                                  variant="contained"
                                  size="small"
                                  disabled={sendingComment === event.event_id || !commentInputs[event.event_id]?.trim()}
                                  onClick={() => handleSendComment(event.event_id)}
                                >
                                  Send
                                </Button>
                              </Stack>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
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
