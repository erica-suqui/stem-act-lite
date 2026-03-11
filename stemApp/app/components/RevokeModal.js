'use client';

import { useEffect, useRef } from 'react';
import Modal from './Modal';

export default function RevokeModal({ event, onRevoke, onClose }) {
	const confirmRef = useRef(null);

	useEffect(() => { confirmRef.current?.focus(); }, []);

	return (
		<Modal headingId="revoke-modal-heading" onClose={onClose}>
			<h3 id="revoke-modal-heading">Revoke Approval</h3>
			<p>
				Are you sure you want to revoke approval for <strong>{event.title}</strong>?
				It will be removed from the public catalog and returned to <strong>pending</strong> for re-review.
			</p>
			<div className="modal-actions" style={{ marginTop: '1.5rem' }}>
				<button type="button" className="btn btn-cancel" onClick={onClose}>
					Cancel
				</button>
				<button
					type="button"
					className="btn btn-deny"
					ref={confirmRef}
					onClick={onRevoke}
				>
					Yes, Revoke
				</button>
			</div>
		</Modal>
	);
}
