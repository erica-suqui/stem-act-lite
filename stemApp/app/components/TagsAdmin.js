'use client';

import React, { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Toast from './Toast';
import {
  Stack, Typography, TextField, Button, Chip, Alert,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Divider,
} from '@mui/material';

export default function TagsAdmin() {
  const [tags, setTags]       = useState([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const { toasts, addToast, dismissToast } = useToast();

  const activeTags      = tags.filter(t => t.is_active);
  const deactivatedTags = tags.filter(t => !t.is_active);

  const fetchTags = () => {
    fetch(apiUrl('/api/tags'))
      .then(r => r.json())
      .then(data => { if (data.success) setTags(data.tags); });
  };

  useEffect(() => { fetchTags(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/tags'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNewName('');
        fetchTags();
        addToast(`Tag "${data.tag.name}" created.`, 'success');
      } else {
        addToast(data.message || 'Failed to create tag.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (tag) => {
    const res = await fetch(apiUrl(`/api/tags/${tag.tag_id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !tag.is_active }),
    });
    const data = await res.json();
    if (data.success) {
      fetchTags();
      addToast(
        `"${tag.name}" ${tag.is_active ? 'deactivated' : 'reactivated'}.`,
        'success'
      );
    } else {
      addToast('Failed to update tag.', 'error');
    }
  };

  const TagTable = ({ rows, emptyMessage, actionLabel, actionColor }) => (
    <TableContainer component={Paper} elevation={1}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'primary.dark' }}>
            {['Tag Name', 'Slug', 'Actions'].map(h => (
              <TableCell key={h} sx={{ color: 'white', fontWeight: 600 }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(tag => (
            <TableRow key={tag.tag_id} hover>
              <TableCell>
                <Typography variant="body2" fontWeight={500}>{tag.name}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">{tag.slug}</Typography>
              </TableCell>
              <TableCell>
                <Button
                  size="small"
                  variant="outlined"
                  color={actionColor}
                  onClick={() => handleToggle(tag)}
                >
                  {actionLabel}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                <Typography variant="body2" color="text.secondary">{emptyMessage}</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Tag Manager</Typography>
        <Chip
          label={`${activeTags.length} active`}
          size="small"
          sx={{ borderRadius: 1, fontWeight: 500 }}
        />
      </Stack>

      {/* Approaching limit warning */}
      {activeTags.length >= 45 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You have {activeTags.length} active tags. Consider reviewing existing tags
          before adding more — a concise list (under 50) keeps submission forms
          easy to navigate.
        </Alert>
      )}

      {/* Create new tag */}
      <Stack direction="row" spacing={1} sx={{ mb: 3 }} alignItems="center">
        <TextField
          size="small"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New tag name…"
          sx={{ minWidth: 240 }}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          inputProps={{ maxLength: 50 }}
          helperText={`${newName.length}/50`}
        />
        <Button
          variant="contained"
          size="small"
          onClick={handleCreate}
          disabled={loading || !newName.trim() || activeTags.length >= 50}
        >
          + Add Tag
        </Button>
      </Stack>

      {/* Active tags */}
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
        Active Tags
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          ({activeTags.length}/50)
        </Typography>
      </Typography>
      <TagTable
        rows={activeTags}
        emptyMessage="No active tags yet. Add one above."
        actionLabel="Deactivate"
        actionColor="error"
      />

      {/* Deactivated tags */}
      {deactivatedTags.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Deactivated Tags
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              (hidden from submission forms, existing event links preserved)
            </Typography>
          </Typography>
          <TagTable
            rows={deactivatedTags}
            emptyMessage="No deactivated tags."
            actionLabel="Reactivate"
            actionColor="success"
          />
        </>
      )}

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
