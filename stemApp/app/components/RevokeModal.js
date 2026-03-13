'use client';

import { useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

export default function RevokeModal({ event, onRevoke, onClose }) {
  const confirmRef = useRef(null);
  useEffect(() => { confirmRef.current?.focus(); }, []);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Revoke Approval</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to revoke approval for <strong>{event.title}</strong>?
          It will be removed from the public catalog and returned to <strong>pending</strong> for re-review.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button ref={confirmRef} variant="contained" color="error" onClick={onRevoke}>
          Yes, Revoke
        </Button>
      </DialogActions>
    </Dialog>
  );
}
