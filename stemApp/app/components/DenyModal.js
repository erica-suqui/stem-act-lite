'use client';

import { useState, useEffect, useRef } from 'react';
import Modal from './Modal';

export default function DenyModal({ event, onDeny, onClose }) {
	const [comment, setComment] = useState('');
	const textareaRef = useRef(null);

	useEffect(() => { textareaRef.current?.focus(); }, []);

	function handleSubmit(e) {
		e.preventDefault();
		if (!comment.trim()) return;
		onDeny(comment);
	}

	return (
		<Modal headingId="deny-modal-heading" onClose={onClose}>
			<h3 id="deny-modal-heading">Deny Event: {event.title}</h3>
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
		</Modal>
	);
}
