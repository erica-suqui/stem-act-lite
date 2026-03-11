'use client';

import { useEffect, useRef } from 'react';
import Modal from './Modal';

export default function DeleteUserModal({ user, onDelete, onClose }) {
	const confirmRef = useRef(null);

	useEffect(() => { confirmRef.current?.focus(); }, []);

	return (
		<Modal headingId="delete-modal-heading" onClose={onClose}>
			<h3 id="delete-modal-heading">Delete User</h3>
			<p>
				Are you sure you want to permanently delete{' '}
				<strong>{user.email}</strong>? This cannot be undone.
			</p>
			<div className="modal-actions" style={{ marginTop: '1.5rem' }}>
				<button type="button" className="btn btn-cancel" onClick={onClose}>
					Cancel
				</button>
				<button
					ref={confirmRef}
					type="button"
					className="btn btn-deny"
					onClick={onDelete}
				>
					Delete Permanently
				</button>
			</div>
		</Modal>
	);
}
