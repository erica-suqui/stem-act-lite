'use client';

import { useEffect, useRef } from 'react';

export default function ApproveModal({ event, onApprove, onClose }) {
	const modalRef = useRef(null);
	const confirmBtnRef = useRef(null);
	const headingId = 'approve-modal-heading';

	// Move focus to confirm button on open (WCAG 2.1.2)
	useEffect(() => {
		confirmBtnRef.current?.focus();
	}, []);

	// Focus trap + Escape to close (WCAG 2.1.2)
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
		const last = focusable[focusable.length - 1];

		if (e.shiftKey) {
			if (document.activeElement === first) {
				e.preventDefault();
				last.focus();
			}
		} else {
			if (document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
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
				<h3 id={headingId}>Approve Event</h3>
				<p>
					Are you sure you want to approve <strong>{event.title}</strong>?
					It will be immediately published to the public event catalog.
				</p>
				<div className="modal-actions" style={{ marginTop: '1.5rem' }}>
					<button type="button" className="btn btn-cancel" onClick={onClose}>
						Cancel
					</button>
					<button
						type="button"
						className="btn btn-approve"
						ref={confirmBtnRef}
						onClick={onApprove}
					>
						Yes, Approve
					</button>
				</div>
			</div>
		</div>
	);
}
