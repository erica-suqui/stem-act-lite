'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Button, TextField
} from '@mui/material';

export default function DenyModal({ event, onDeny, onClose }) {
  const [comment, setComment] = useState('');
  const textareaRef = useRef(null);
  useEffect(() => { textareaRef.current?.focus(); }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    onDeny(comment);
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Deny Event: {event.title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          This comment will be visible to the partner organization.
        </DialogContentText>
        <TextField
          inputRef={textareaRef}
          label="Comment (required)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          multiline
          rows={4}
          fullWidth
          required
          placeholder="Explain why this event is being denied..."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          disabled={!comment.trim()}
          onClick={handleSubmit}
        >
          Deny Event
        </Button>
      </DialogActions>
    </Dialog>
  );
}
