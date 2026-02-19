'use client';

import { CheckCircle, XCircle } from 'lucide-react';

export default function Toast({ toasts, onDismiss }) {
	if (toasts.length === 0) return null;

	return (
		/* aria-live so screen readers announce toasts (WCAG 4.1.3) */
		<div className="toast-container" aria-live="polite" aria-atomic="false">
			{toasts.map(toast => (
				<div
					key={toast.id}
					className={`toast toast-${toast.type}`}
					role="status"
				>
					{toast.type === 'success'
						? <CheckCircle size={16} aria-hidden="true" />
						: <XCircle size={16} aria-hidden="true" />
					}
					<span>{toast.message}</span>
					{onDismiss && (
						<button
							className="toast-dismiss"
							onClick={() => onDismiss(toast.id)}
							aria-label="Dismiss notification"
						>
							<XCircle size={14} aria-hidden="true" />
						</button>
					)}
				</div>
			))}
		</div>
	);
}
