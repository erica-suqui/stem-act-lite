'use client';

import { useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Button, FormControl, InputLabel, Select, MenuItem, Typography
} from '@mui/material';
import { VALID_ROLES } from '@/lib/constants';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  partner:     'Partner',
};

export default function EditRoleModal({ user, currentRole, superAdminTakenBy, onRoleChange, onSave, onClose }) {
  const selectRef = useRef(null);
  useEffect(() => { selectRef.current?.node?.focus(); }, []);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit Role</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Updating role for <strong>{user.email}</strong>.
        </DialogContentText>
        <FormControl fullWidth size="small">
          <InputLabel id="edit-role-label">Role</InputLabel>
          <Select
            labelId="edit-role-label"
            value={currentRole}
            label="Role"
            onChange={e => onRoleChange(e.target.value)}
          >
            {VALID_ROLES.map(role => (
              <MenuItem
                key={role}
                value={role}
                disabled={role === 'super_admin' && !!superAdminTakenBy}
              >
                {ROLE_LABELS[role]}
                {role === 'super_admin' && superAdminTakenBy && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    — taken by {superAdminTakenBy.email}
                  </Typography>
                )}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave} disabled={currentRole === user.role}>
          Save Role
        </Button>
      </DialogActions>
    </Dialog>
  );
}
