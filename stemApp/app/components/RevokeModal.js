'use client';

import { useEffect, useRef } from 'react';

export default function RevokeModal({ event, onRevoke, onClose }) {
	const modalRef    = useRef(null);
	const confirmBtnRef = useRef(null);
	const headingId   = 'revoke-modal-heading';

	useEffect(() => {
		confirmBtnRef.current?.focus();
	}, []);

	function handleKeyDown(e) {
		if (e.key === 'Escape') {
			onClose();
			return;
		}
		if (e.key !== 'Tab') return;

		const focusable = modalRef.current.querySelectorAll(
			'button, [tabindex]:not([tabindex="-1"])'
		);
		const first = focusable[0];
		const last  = focusable[focusable.length - 1];

		if (e.shiftKey) {
			if (document.activeElement === first) { e.preventDefault(); last.focus(); }
		} else {
			if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
		}
	}

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div
				className="modal-content"
				ref={modalRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={headingId}
				onClick={e => e.stopPropagation()}
				onKeyDown={handleKeyDown}
			>
				<button className="modal-close" onClick={onClose} aria-label="Close dialog">
					&times;
				</button>
				<h3 id={headingId}>Revoke Approval</h3>
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
						ref={confirmBtnRef}
						onClick={onRevoke}
					>
						Yes, Revoke
					</button>
				</div>
			</div>
		</div>
	);
}
