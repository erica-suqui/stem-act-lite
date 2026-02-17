'use client';

import React, { useState } from 'react';
import DenyModal from './DenyModal';

export default function EventsTable({ events }) {
	const [filter, setFilter] = useState('all');
	const [expandedId, setExpandedId] = useState(null);
	const [denyTarget, setDenyTarget] = useState(null);

	const filtered = filter === 'all'
		? events
		: events.filter(e => e.status === filter);

	async function handleApprove(eventId) {
		const res = await fetch(`/api/events/${eventId}/approve`, { method: 'POST' });
		const data = await res.json();
		if (data.success) {
			window.location.reload();
		} else {
			alert('Error: ' + data.message);
		}
	}

	async function handleDeny(eventId, comment) {
		const res = await fetch(`/api/events/${eventId}/deny`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ comment }),
		});
		const data = await res.json();
		if (data.success) {
			window.location.reload();
		} else {
			alert('Error: ' + data.message);
		}
	}

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
			<div className="filter-bar">
				<label htmlFor="status-filter">Filter by status:</label>
				<select
					id="status-filter"
					value={filter}
					onChange={e => setFilter(e.target.value)}
				>
					<option value="all">All</option>
					<option value="pending">Pending</option>
					<option value="approved">Approved</option>
					<option value="denied">Denied</option>
				</select>
			</div>

			<div className="table-wrapper">
				<table className="data-table">
					<thead>
						<tr>
							<th>Event Title</th>
							<th>Organization</th>
							<th>Date</th>
							<th>Location</th>
							<th>Audience</th>
							<th>Cost</th>
							<th>Status</th>
							<th>Submitted</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{filtered.map(event => (
							<React.Fragment key={event.event_id}>
								<tr className="event-row">
									<td>
										<strong>{event.title}</strong>
										{event.event_link && (
											<>
												<br />
												<a href={event.event_link} target="_blank" rel="noopener noreferrer">
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
											{event.status}
										</span>
									</td>
									<td>{formatDate(event.submitted_at)}</td>
									<td className="actions-cell">
										{event.status === 'pending' && (
											<>
												<button
													className="btn btn-approve"
													onClick={() => handleApprove(event.event_id)}
												>
													Approve
												</button>
												<button
													className="btn btn-deny"
													onClick={() => setDenyTarget(event)}
												>
													Deny
												</button>
											</>
										)}
										{event.status === 'approved' && (
											<button
												className="btn btn-deny"
												onClick={() => setDenyTarget(event)}
											>
												Revoke
											</button>
										)}
										{event.status === 'denied' && (
											<button
												className="btn btn-approve"
												onClick={() => handleApprove(event.event_id)}
											>
												Approve
											</button>
										)}
										<button
											className="btn btn-details"
											onClick={() => setExpandedId(
												expandedId === event.event_id ? null : event.event_id
											)}
										>
											{expandedId === event.event_id ? 'Hide' : 'Details'}
										</button>
									</td>
								</tr>
								{expandedId === event.event_id && (
									<tr className="details-row">
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
						))}
						{filtered.length === 0 && (
							<tr>
								<td colSpan={9} className="no-data">No events found.</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{denyTarget && (
				<DenyModal
					event={denyTarget}
					onDeny={(comment) => {
						handleDeny(denyTarget.event_id, comment);
						setDenyTarget(null);
					}}
					onClose={() => setDenyTarget(null)}
				/>
			)}
		</>
	);
}
