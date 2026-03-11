'use client';

import { useEffect, useRef } from 'react';
import Modal from './Modal';
import { VALID_ROLES } from '@/lib/constants';

const ROLE_LABELS = {
	super_admin: 'Super Admin',
	admin:       'Admin',
	partner:     'Partner',
};

export default function EditRoleModal({ user, currentRole, superAdminTakenBy, onRoleChange, onSave, onClose }) {
	const selectRef = useRef(null);

	useEffect(() => { selectRef.current?.focus(); }, []);

	return (
		<Modal headingId="edit-role-heading" onClose={onClose}>
			<h3 id="edit-role-heading">Edit Role</h3>
			<p style={{ marginBottom: '1rem' }}>
				Updating role for <strong>{user.email}</strong>.
			</p>
			<label htmlFor="edit-role-select">Role:</label>
			<select
				id="edit-role-select"
				ref={selectRef}
				className="role-select"
				value={currentRole}
				onChange={e => onRoleChange(e.target.value)}
			>
				{VALID_ROLES.map(role => (
					<option
						key={role}
						value={role}
						disabled={role === 'super_admin' && !!superAdminTakenBy}
					>
						{ROLE_LABELS[role]}
						{role === 'super_admin' && superAdminTakenBy
							? ` — taken by ${superAdminTakenBy.email}`
							: ''
						}
					</option>
				))}
			</select>
			<div className="modal-actions">
				<button type="button" className="btn btn-cancel" onClick={onClose}>
					Cancel
				</button>
				<button
					type="button"
					className="btn btn-approve"
					onClick={onSave}
					disabled={currentRole === user.role}
				>
					Save Role
				</button>
			</div>
		</Modal>
	);
}
