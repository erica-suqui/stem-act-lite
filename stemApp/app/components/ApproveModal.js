'use client';

import { useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

export default function ApproveModal({ event, onApprove, onClose }) {
  const confirmRef = useRef(null);
  useEffect(() => { confirmRef.current?.focus(); }, []);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Approve Event</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to approve <strong>{event.title}</strong>?
          It will be immediately published to the public event catalog.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button ref={confirmRef} variant="contained" color="success" onClick={onApprove}>
          Yes, Approve
        </Button>
      </DialogActions>
    </Dialog>
  );
}
