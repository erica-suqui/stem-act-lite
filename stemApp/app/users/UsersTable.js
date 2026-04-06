'use client';

import React, { useState, useCallback } from 'react';
import Toast from '../components/Toast';
import { useToast } from '@/hooks/useToast';
import EditRoleModal from '../components/EditRoleModal';
import DeleteUserModal from '../components/DeleteUserModal';
import { apiUrl } from '@/lib/api';
import {
  Stack, TextField,
  Typography, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';

const ROLE_CHIP = {
  super_admin: { label: 'Super Admin', color: 'error'   },
  admin:       { label: 'Admin',       color: 'primary' },
  partner:     { label: 'Partner',     color: 'default' },
};

const ROLE_PILLS = [
  { key: 'all',         label: 'All',         color: 'default' },
  { key: 'partner',     label: 'Partners',     color: 'warning' },
  { key: 'admin',       label: 'Admins',       color: 'success' },
  { key: 'super_admin', label: 'Super Admins', color: 'error'   },
];

export default function UsersTable({ users: initialUsers }) {
  const [users, setUsers]               = useState(initialUsers);
  const [search, setSearch]             = useState('');
  const [roleFilter, setRoleFilter]     = useState('all');
  const [loadingId, setLoadingId]       = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget]     = useState(null);
  const [editRole, setEditRole]         = useState('');
const { toasts, addToast, dismissToast } = useToast();

  const superAdminUser = users.find(u => u.role === 'super_admin') ?? null;

  const stats = {
    total:       users.length,
    superAdmins: users.filter(u => u.role === 'super_admin').length,
    admins:      users.filter(u => u.role === 'admin').length,
    partners:    users.filter(u => u.role === 'partner').length,
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = u.email.toLowerCase().includes(q) || (u.org_name || '').toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleDelete = useCallback(async (userId, email) => {
    setLoadingId(userId);
    setDeleteTarget(null);
    try {
      const res = await fetch(apiUrl(`/api/users/${userId}/delete`), { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.filter(u => u.user_id !== userId));
        addToast(`${email} has been deleted.`, 'success');
      } else {
        addToast('Error: ' + data.message, 'error');
      }
    } catch {
      addToast('Network error. Please try again.', 'error');
    } finally {
      setLoadingId(null);
    }
  }, []);

  const handleEditRole = useCallback(async () => {
    if (!editTarget || !editRole) return;
    const target = editTarget;
    const role = editRole;
    setLoadingId(target.user_id);
    setEditTarget(null);
    try {
      const res = await fetch(apiUrl(`/api/users/${target.user_id}/role`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.map(u => u.user_id === target.user_id ? { ...u, role } : u));
        addToast(`${target.email}'s role updated to ${ROLE_CHIP[role]?.label ?? role}.`, 'success');
      } else {
        addToast('Error: ' + data.message, 'error');
      }
    } catch {
      addToast('Network error. Please try again.', 'error');
    } finally {
      setLoadingId(null);
    }
  }, [editTarget, editRole]);

  const handleUnlinkGoogle = useCallback(async (user) => {
    setLoadingId(user.user_id);
    try {
      const res = await fetch(apiUrl(`/api/users/${user.user_id}/unlink-google`), { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.map(u =>
          u.user_id === user.user_id ? { ...u, google_linked: false } : u
        ));
        addToast(`Google account unlinked from ${user.email}.`, 'success');
      } else {
        addToast('Error: ' + data.message, 'error');
      }
    } catch {
      addToast('Network error. Please try again.', 'error');
    } finally {
      setLoadingId(null);
    }
  }, []);

  const superAdminTakenBy = editTarget && superAdminUser && superAdminUser.user_id !== editTarget.user_id
    ? superAdminUser : null;

  return (
    <>
      {/* Role pill filters */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
        {ROLE_PILLS.map(({ key, label, color }) => {
          const active = roleFilter === key;
          const count = key === 'all' ? stats.total : stats[key === 'partner' ? 'partners' : key === 'admin' ? 'admins' : 'superAdmins'];
          return (
            <Chip
              key={key}
              label={`${label} ${count}`}
              color={active ? color : 'default'}
              variant={active ? 'filled' : 'outlined'}
              onClick={() => setRoleFilter(key)}
              clickable
              size="small"
              aria-pressed={active}
              aria-label={`Filter by ${label} — ${count} ${label.toLowerCase()}`}
              sx={{ borderRadius: 4, fontWeight: active ? 600 : 400, px: 0.5 }}
            />
          );
        })}
      </Stack>

      {/* Filters */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Email or organization…"
          label="Search"
          sx={{ minWidth: 240 }}
          inputProps={{ 'aria-label': 'Search by email or organization' }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }} aria-live="polite" aria-atomic="true">
          {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
        </Typography>
      </Stack>

      {/* Users Table */}
      <TableContainer component={Paper} elevation={1}>
        <Table size="small" aria-label="User accounts">
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.dark' }}>
              {['Email', 'Role', 'Organization', 'Google', 'Actions'].map(h => (
                <TableCell key={h} scope="col" sx={{ color: 'white', fontWeight: 600 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(user => {
              const isLoading = loadingId === user.user_id;
              const chipProps = ROLE_CHIP[user.role] ?? { label: user.role, color: 'default' };
              return (
                <TableRow key={user.user_id} hover>
                  <TableCell><Typography variant="body2">{user.email}</Typography></TableCell>
                  <TableCell>
                    <Chip label={chipProps.label} color={chipProps.color} size="small" />
                  </TableCell>
                  <TableCell><Typography variant="body2">{user.org_name || '—'}</Typography></TableCell>
                  <TableCell>
                    {user.google_linked
                      ? <Chip label="Connected" color="success" size="small" />
                      : <Typography variant="body2" color="text.secondary">—</Typography>
                    }
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" variant="outlined" disabled={isLoading}
                        onClick={() => { setEditTarget(user); setEditRole(user.role); }}
                        aria-label={`Edit role for ${user.email}`}>
                        Edit Role
                      </Button>
                      <Button size="small" variant="contained" color="error" disabled={isLoading}
                        onClick={() => setDeleteTarget(user)}
                        aria-label={`Delete user ${user.email}`}>
                        Delete
                      </Button>
                      {user.google_linked && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          disabled={isLoading}
                          onClick={() => handleUnlinkGoogle(user)}
                          aria-label={`Unlink Google account for ${user.email}`}
                        >
                          Unlink Google
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No users match your search.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {editTarget && (
        <EditRoleModal
          user={editTarget}
          currentRole={editRole}
          superAdminTakenBy={superAdminTakenBy}
          onRoleChange={setEditRole}
          onSave={handleEditRole}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          onDelete={() => handleDelete(deleteTarget.user_id, deleteTarget.email)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
