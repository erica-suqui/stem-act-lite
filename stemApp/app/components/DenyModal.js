'use client';

import { useState } from 'react';

export default function DenyModal({ event, onDeny, onClose }) {
	const [comment, setComment] = useState('');

	function handleSubmit(e) {
		e.preventDefault();
		if (!comment.trim()) return;
		onDeny(comment);
	}

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={e => e.stopPropagation()}>
				<button className="modal-close" onClick={onClose}>&times;</button>
				<h3>Deny Event: {event.title}</h3>
				<form onSubmit={handleSubmit}>
					<label htmlFor="deny-comment">Comment (required):</label>
					<textarea
						id="deny-comment"
						value={comment}
						onChange={e => setComment(e.target.value)}
						rows={4}
						required
						placeholder="Explain why this event is being denied..."
					/>
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
