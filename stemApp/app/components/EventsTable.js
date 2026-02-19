'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import DenyModal from './DenyModal';
import ApproveModal from './ApproveModal';
import Toast from './Toast';

const STATUS_META = {
	pending:  { Icon: Clock,       label: 'Pending' },
	approved: { Icon: CheckCircle, label: 'Approved' },
	denied:   { Icon: XCircle,     label: 'Denied' },
};

export default function EventsTable({ events, organizations }) {
	const router = useRouter();
	const [statusFilter, setStatusFilter] = useState('all');
	const [orgFilter, setOrgFilter] = useState('all');
	const [expandedId, setExpandedId] = useState(null);
	const [denyTarget, setDenyTarget] = useState(null);
	const [approveTarget, setApproveTarget] = useState(null);
	const [loadingId, setLoadingId] = useState(null);
	const [toasts, setToasts] = useState([]);

	const filtered = events.filter(e => {
		const matchStatus = statusFilter === 'all' || e.status === statusFilter;
		const matchOrg = orgFilter === 'all' || String(e.org_id) === orgFilter;
		return matchStatus && matchOrg;
	});

	function addToast(message, type = 'success') {
		const id = Date.now();
		setToasts(prev => [...prev, { id, message, type }]);
		if (type === 'success') {
			setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
		}
		// Errors persist until manually dismissed
	}

	function dismissToast(id) {
		setToasts(prev => prev.filter(t => t.id !== id));
	}

	const handleApprove = useCallback(async (eventId, title) => {
		setLoadingId(eventId);
		setApproveTarget(null);
		try {
			const res = await fetch(`/api/events/${eventId}/approve`, { method: 'POST' });
			const data = await res.json();
			if (data.success) {
				addToast(`"${title}" has been approved and published.`, 'success');
				router.refresh(); // Refresh server data without full page reload
			} else {
				addToast('Error: ' + data.message, 'error');
			}
		} catch {
			addToast('Network error. Please try again.', 'error');
		} finally {
			setLoadingId(null);
		}
	}, [router]);

	const handleDeny = useCallback(async (eventId, title, comment) => {
		setLoadingId(eventId);
		setDenyTarget(null);
		try {
			const res = await fetch(`/api/events/${eventId}/deny`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ comment }),
			});
			const data = await res.json();
			if (data.success) {
				addToast(`"${title}" has been denied. The partner has been notified.`, 'success');
				router.refresh();
			} else {
				addToast('Error: ' + data.message, 'error');
			}
		} catch {
			addToast('Network error. Please try again.', 'error');
		} finally {
			setLoadingId(null);
		}
	}, [router]);

	function formatDate(dateStr) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short', day: 'numeric', year: 'numeric',
		});
	}

	function formatCost(cost) {
		const num = parseFloat(cost);
		return num === 0 ? 'Free' : `$${num.toFixed(2)}`;
	}

	return (
		<>
			<div className="filter-bar" aria-label="Filter events">
				<label htmlFor="status-filter">Status:</label>
				<select
					id="status-filter"
					value={statusFilter}
					onChange={e => setStatusFilter(e.target.value)}
				>
					<option value="all">All statuses</option>
					<option value="pending">Pending</option>
					<option value="approved">Approved</option>
					<option value="denied">Denied</option>
				</select>

				<label htmlFor="org-filter">Organization:</label>
				<select
					id="org-filter"
					value={orgFilter}
					onChange={e => setOrgFilter(e.target.value)}
				>
					<option value="all">All organizations</option>
					{organizations.map(org => (
						<option key={org.org_id} value={String(org.org_id)}>
							{org.org_name}
						</option>
					))}
				</select>

				<span className="result-count" aria-live="polite" aria-atomic="true">
					{filtered.length} {filtered.length === 1 ? 'event' : 'events'}
				</span>
			</div>

			<div className="table-wrapper">
				<table className="data-table">
					<caption className="table-caption">
						Event submissions — {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
					</caption>
					<thead>
						<tr>
							<th scope="col">Event Title</th>
							<th scope="col">Organization</th>
							<th scope="col">Date</th>
							<th scope="col">Location</th>
							<th scope="col">Audience</th>
							<th scope="col">Cost</th>
							<th scope="col">Status</th>
							<th scope="col">Submitted</th>
							<th scope="col">Actions</th>
						</tr>
					</thead>
					<tbody>
						{filtered.map(event => {
							const isLoading = loadingId === event.event_id;
							const statusMeta = STATUS_META[event.status];
							const StatusIcon = statusMeta?.Icon;
							return (
								<React.Fragment key={event.event_id}>
									<tr className="event-row">
										<td>
											<strong>{event.title}</strong>
											{event.event_link && (
												<>
													<br />
													<a
														href={event.event_link}
														target="_blank"
														rel="noopener noreferrer"
														aria-label={`${event.title} — external event link (opens in new tab)`}
													>
														Event Link
													</a>
												</>
											)}
										</td>
										<td>
											{event.org_name}
											<br />
											<small>{event.contact_email}</small>
										</td>
										<td>
											{formatDate(event.start_datetime)}
											{event.end_datetime && (
												<>
													<br />
													<small>to {formatDate(event.end_datetime)}</small>
												</>
											)}
										</td>
										<td>
											{event.city}, {event.county}
											<br />
											<small>{event.address}</small>
										</td>
										<td>{event.audience}</td>
										<td>{formatCost(event.cost)}</td>
										<td>
											<span className={`status-badge status-${event.status}`}>
												{StatusIcon && (
													<StatusIcon size={12} aria-hidden="true" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
												)}
												{statusMeta?.label ?? event.status}
											</span>
										</td>
										<td>{formatDate(event.submitted_at)}</td>
										<td className="actions-cell">
											{event.status === 'pending' && (
												<>
													<button
														className={`btn btn-approve${isLoading ? ' btn-loading' : ''}`}
														onClick={() => setApproveTarget(event)}
														disabled={isLoading}
														aria-label={`Approve event: ${event.title}`}
													>
														Approve
													</button>
													<button
														className={`btn btn-deny${isLoading ? ' btn-loading' : ''}`}
														onClick={() => setDenyTarget(event)}
														disabled={isLoading}
														aria-label={`Deny event: ${event.title}`}
													>
														Deny
													</button>
												</>
											)}
											{event.status === 'approved' && (
												<button
													className={`btn btn-deny${isLoading ? ' btn-loading' : ''}`}
													onClick={() => setDenyTarget(event)}
													disabled={isLoading}
													aria-label={`Revoke approval for: ${event.title}`}
												>
													Revoke
												</button>
											)}
											{event.status === 'denied' && (
												<button
													className={`btn btn-approve${isLoading ? ' btn-loading' : ''}`}
													onClick={() => setApproveTarget(event)}
													disabled={isLoading}
													aria-label={`Approve event: ${event.title}`}
												>
													Approve
												</button>
											)}
											<button
												className="btn btn-details"
												onClick={() => setExpandedId(
													expandedId === event.event_id ? null : event.event_id
												)}
												aria-expanded={expandedId === event.event_id}
												aria-controls={`details-${event.event_id}`}
												aria-label={`${expandedId === event.event_id ? 'Hide' : 'Show'} details for: ${event.title}`}
											>
												{expandedId === event.event_id ? 'Hide' : 'Details'}
											</button>
										</td>
									</tr>
									{expandedId === event.event_id && (
										<tr className="details-row" id={`details-${event.event_id}`}>
											<td colSpan={9}>
												<div className="event-details">
													<h4>Description</h4>
													<p>{event.description}</p>
													{event.admin_comment && (
														<>
															<h4>Admin Comment</h4>
															<p className="admin-comment">{event.admin_comment}</p>
														</>
													)}
												</div>
											</td>
										</tr>
									)}
								</React.Fragment>
							);
						})}
						{filtered.length === 0 && (
							<tr>
								<td colSpan={9} className="no-data">
									No events match the selected filters.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{approveTarget && (
				<ApproveModal
					event={approveTarget}
					onApprove={() => handleApprove(approveTarget.event_id, approveTarget.title)}
					onClose={() => setApproveTarget(null)}
				/>
			)}
			{denyTarget && (
				<DenyModal
					event={denyTarget}
					onDeny={(comment) => handleDeny(denyTarget.event_id, denyTarget.title, comment)}
					onClose={() => setDenyTarget(null)}
				/>
			)}

			<Toast toasts={toasts} onDismiss={dismissToast} />
		</>
	);
}
