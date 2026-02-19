'use client';

import { useState, useEffect, useRef } from 'react';

export default function DenyModal({ event, onDeny, onClose }) {
	const [comment, setComment] = useState('');
	const textareaRef = useRef(null);
	const modalRef = useRef(null);
	const headingId = 'deny-modal-heading';

	// Move focus into modal on open (WCAG 2.1.2)
	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	// Focus trap — keep Tab/Shift+Tab inside modal (WCAG 2.1.2)
	function handleKeyDown(e) {
		if (e.key === 'Escape') {
			onClose();
			return;
		}
		if (e.key !== 'Tab') return;

		const focusable = modalRef.current.querySelectorAll(
			'button, textarea, [tabindex]:not([tabindex="-1"])'
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

	function handleSubmit(e) {
		e.preventDefault();
		if (!comment.trim()) return;
		onDeny(comment);
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
				<button
					className="modal-close"
					onClick={onClose}
					aria-label="Close dialog"
				>
					&times;
				</button>
				<h3 id={headingId}>Deny Event: {event.title}</h3>
				<form onSubmit={handleSubmit}>
					<label htmlFor="deny-comment">
						Comment <span aria-hidden="true">(required)</span>:
					</label>
					<textarea
						id="deny-comment"
						ref={textareaRef}
						value={comment}
						onChange={e => setComment(e.target.value)}
						rows={4}
						required
						aria-required="true"
						aria-describedby="deny-comment-hint"
						placeholder="Explain why this event is being denied..."
					/>
					<p id="deny-comment-hint" className="field-hint">
						This comment will be sent to the partner organization.
					</p>
					<div className="modal-actions">
						<button type="button" className="btn btn-cancel" onClick={onClose}>
							Cancel
						</button>
						<button type="submit" className="btn btn-deny">
							Deny Event
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
