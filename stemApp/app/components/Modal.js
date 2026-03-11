'use client';

// Base modal — handles overlay, focus trap, Escape key, and ARIA.
// Each specific modal is responsible for its own initial focus via useEffect.

import { useRef } from 'react';

export default function Modal({ headingId, onClose, children }) {
	const modalRef = useRef(null);

	function handleKeyDown(e) {
		if (e.key === 'Escape') { onClose(); return; }
		if (e.key !== 'Tab') return;

		const focusable = modalRef.current.querySelectorAll(
			'button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
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
				{children}
			</div>
		</div>
	);
}
