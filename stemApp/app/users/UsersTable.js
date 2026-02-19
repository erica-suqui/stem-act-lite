'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Shield, Building2 } from 'lucide-react';
import Toast from '../components/Toast';

const ROLE_META = {
	super_admin: { Icon: ShieldCheck, label: 'Super Admin' },
	admin:       { Icon: Shield,      label: 'Admin' },
	partner:     { Icon: Building2,   label: 'Partner' },
};

export default function UsersTable({ users }) {
	const router = useRouter();
	const [search, setSearch] = useState('');
	const [roleFilter, setRoleFilter] = useState('all');
	const [loadingId, setLoadingId] = useState(null);
	const [deleteTarget, setDeleteTarget] = useState(null);
	const [editTarget, setEditTarget] = useState(null);
	const [editRole, setEditRole] = useState('');
	const [toasts, setToasts] = useState([]);
	const [inviteRole, setInviteRole] = useState('admin');
	const [inviteLink, setInviteLink] = useState(null);
	const [inviteLoading, setInviteLoading] = useState(false);
	const deleteConfirmRef = useRef(null);
	const editConfirmRef = useRef(null);

	// Derived: who currently holds super_admin (if anyone)
	const superAdminUser = users.find(u => u.role === 'super_admin') ?? null;

	function addToast(message, type = 'success') {
		const id = Date.now();
		setToasts(prev => [...prev, { id, message, type }]);
		if (type === 'success') {
			setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
		}
		// Errors persist until manually dismissed
	}

	function dismissToast(id) {
		setToasts(prev => prev.filter(t => t.id !== id));
	}

	const filtered = users.filter(u => {
		const q = search.toLowerCase();
		const matchSearch = u.email.toLowerCase().includes(q) ||
			(u.org_name || '').toLowerCase().includes(q);
		const matchRole = roleFilter === 'all' || u.role === roleFilter;
		return matchSearch && matchRole;
	});

	const handleDelete = useCallback(async (userId, email) => {
		setLoadingId(userId);
		setDeleteTarget(null);
		try {
			const res = await fetch(`/api/users/${userId}/delete`, { method: 'POST' });
			const data = await res.json();
			if (data.success) {
				addToast(`${email} has been deleted.`, 'success');
				router.refresh();
			} else {
				addToast('Error: ' + data.message, 'error');
			}
		} catch {
			addToast('Network error. Please try again.', 'error');
		} finally {
			setLoadingId(null);
		}
	}, [router]);

	const handleEditRole = useCallback(async () => {
		if (!editTarget || !editRole) return;
		const target = editTarget;
		const role = editRole;
		setLoadingId(target.user_id);
		setEditTarget(null);
		try {
			const res = await fetch(`/api/users/${target.user_id}/role`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role }),
			});
			const data = await res.json();
			if (data.success) {
				addToast(`${target.email}'s role updated to ${ROLE_META[role]?.label ?? role}.`, 'success');
				router.refresh();
			} else {
				addToast('Error: ' + data.message, 'error');
			}
		} catch {
			addToast('Network error. Please try again.', 'error');
		} finally {
			setLoadingId(null);
		}
	}, [editTarget, editRole, router]);

	async function handleGenerateInvite(e) {
		e.preventDefault();
		setInviteLoading(true);
		setInviteLink(null);
		try {
			const res = await fetch('/api/users/invite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: inviteRole }),
			});
			const data = await res.json();
			if (data.success) {
				setInviteLink(data.inviteLink);
			} else {
				addToast('Error: ' + data.message, 'error');
			}
		} catch {
			addToast('Network error. Please try again.', 'error');
		} finally {
			setInviteLoading(false);
		}
	}

	async function copyInviteLink() {
		await navigator.clipboard.writeText(inviteLink);
		addToast('Invite link copied to clipboard.', 'success');
	}

	// Focus confirm button when delete modal opens
	useEffect(() => {
		if (deleteTarget && deleteConfirmRef.current) {
			deleteConfirmRef.current.focus();
		}
	}, [deleteTarget]);

	// Focus role select when edit modal opens
	useEffect(() => {
		if (editTarget && editConfirmRef.current) {
			editConfirmRef.current.focus();
		}
	}, [editTarget]);

	// For the edit modal: is super_admin taken by someone else?
	const superAdminTakenBy = editTarget && superAdminUser && superAdminUser.user_id !== editTarget.user_id
		? superAdminUser
		: null;

	return (
		<>
			{/* Invite Link Generator (US011) */}
			<section className="invite-section" aria-labelledby="invite-heading">
				<h3 id="invite-heading">Generate Admin Invite Link</h3>
				<form className="invite-form" onSubmit={handleGenerateInvite}>
					<label htmlFor="invite-role">Role:</label>
					<select
						id="invite-role"
						value={inviteRole}
						onChange={e => setInviteRole(e.target.value)}
					>
						<option value="admin">Admin</option>
						<option value="super_admin">Super Admin</option>
					</select>
					<button
						type="submit"
						className={`btn btn-details${inviteLoading ? ' btn-loading' : ''}`}
						disabled={inviteLoading}
					>
						{inviteLoading ? 'Generating…' : 'Generate Link'}
					</button>
				</form>

				{inviteLink && (
					<div className="invite-result" role="alert">
						<p className="invite-hint">
							This link expires in 48 hours. Share it securely — do not post publicly.
						</p>
						<div className="invite-link-row">
							<input
								type="text"
								readOnly
								value={inviteLink}
								className="search-input invite-link-input"
								aria-label="Generated invite link"
								onFocus={e => e.target.select()}
							/>
							<button className="btn btn-approve" onClick={copyInviteLink}>
								Copy
							</button>
						</div>
					</div>
				)}
			</section>

			{/* Filters */}
			<div className="filter-bar" aria-label="Filter users">
				<label htmlFor="user-search">Search:</label>
				<input
					id="user-search"
					type="search"
					value={search}
					onChange={e => setSearch(e.target.value)}
					placeholder="Email or organization…"
					className="search-input"
					aria-label="Search by email or organization"
					autoComplete="off"
				/>
				<label htmlFor="role-filter">Role:</label>
				<select
					id="role-filter"
					value={roleFilter}
					onChange={e => setRoleFilter(e.target.value)}
				>
					<option value="all">All roles</option>
					<option value="super_admin">Super Admin</option>
					<option value="admin">Admin</option>
					<option value="partner">Partner</option>
				</select>
				<span className="result-count" aria-live="polite" aria-atomic="true">
					{filtered.length} {filtered.length === 1 ? 'user' : 'users'}
				</span>
			</div>

			{/* Users Table */}
			<div className="table-wrapper">
				<table className="data-table">
					<caption className="table-caption">
						User accounts — {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
					</caption>
					<thead>
						<tr>
							<th scope="col">Email</th>
							<th scope="col">Role</th>
							<th scope="col">Organization</th>
							<th scope="col">Actions</th>
						</tr>
					</thead>
					<tbody>
						{filtered.map(user => {
							const isLoading = loadingId === user.user_id;
							const roleMeta = ROLE_META[user.role] || { Icon: null, label: user.role };
							const RoleIcon = roleMeta.Icon;
							return (
								<tr key={user.user_id}>
									<td>{user.email}</td>
									<td>
										<span className={`status-badge role-${user.role}`}>
											{RoleIcon && (
												<RoleIcon size={12} aria-hidden="true" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
											)}
											{roleMeta.label}
										</span>
									</td>
									<td>{user.org_name || '—'}</td>
									<td className="actions-cell">
										<button
											className={`btn btn-details${isLoading ? ' btn-loading' : ''}`}
											onClick={() => { setEditTarget(user); setEditRole(user.role); }}
											disabled={isLoading}
											aria-label={`Edit role for ${user.email}`}
										>
											Edit Role
										</button>
										<button
											className={`btn btn-deny${isLoading ? ' btn-loading' : ''}`}
											onClick={() => setDeleteTarget(user)}
											disabled={isLoading}
											aria-label={`Delete user ${user.email}`}
										>
											Delete
										</button>
									</td>
								</tr>
							);
						})}
						{filtered.length === 0 && (
							<tr>
								<td colSpan={4} className="no-data">No users match your search.</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{/* Edit Role Modal */}
			{editTarget && (
				<div className="modal-overlay" onClick={() => setEditTarget(null)}>
					<div
						className="modal-content"
						role="dialog"
						aria-modal="true"
						aria-labelledby="edit-role-heading"
						onClick={e => e.stopPropagation()}
						onKeyDown={e => e.key === 'Escape' && setEditTarget(null)}
					>
						<button
							className="modal-close"
							onClick={() => setEditTarget(null)}
							aria-label="Close dialog"
						>
							&times;
						</button>
						<h3 id="edit-role-heading">Edit Role</h3>
						<p style={{ marginBottom: '1rem' }}>
							Updating role for <strong>{editTarget.email}</strong>.
						</p>
						<label htmlFor="edit-role-select">Role:</label>
						<select
							id="edit-role-select"
							ref={editConfirmRef}
							className="role-select"
							value={editRole}
							onChange={e => setEditRole(e.target.value)}
						>
							<option value="super_admin" disabled={!!superAdminTakenBy}>
								Super Admin{superAdminTakenBy ? ` — taken by ${superAdminTakenBy.email}` : ''}
							</option>
							<option value="admin">Admin</option>
							<option value="partner">Partner</option>
						</select>
						<div className="modal-actions">
							<button
								type="button"
								className="btn btn-cancel"
								onClick={() => setEditTarget(null)}
							>
								Cancel
							</button>
							<button
								type="button"
								className="btn btn-approve"
								onClick={handleEditRole}
								disabled={editRole === editTarget.role}
							>
								Save Role
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Delete Confirmation Modal */}
			{deleteTarget && (
				<div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
					<div
						className="modal-content"
						role="dialog"
						aria-modal="true"
						aria-labelledby="delete-modal-heading"
						onClick={e => e.stopPropagation()}
						onKeyDown={e => e.key === 'Escape' && setDeleteTarget(null)}
					>
						<button
							className="modal-close"
							onClick={() => setDeleteTarget(null)}
							aria-label="Close dialog"
						>
							&times;
						</button>
						<h3 id="delete-modal-heading">Delete User</h3>
						<p>
							Are you sure you want to permanently delete{' '}
							<strong>{deleteTarget.email}</strong>? This cannot be undone.
						</p>
						<div className="modal-actions" style={{ marginTop: '1.5rem' }}>
							<button
								type="button"
								className="btn btn-cancel"
								onClick={() => setDeleteTarget(null)}
							>
								Cancel
							</button>
							<button
								ref={deleteConfirmRef}
								type="button"
								className="btn btn-deny"
								onClick={() => handleDelete(deleteTarget.user_id, deleteTarget.email)}
							>
								Delete Permanently
							</button>
						</div>
					</div>
				</div>
			)}

			<Toast toasts={toasts} onDismiss={dismissToast} />
		</>
	);
}
