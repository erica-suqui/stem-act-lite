'use client';

import React, { useState, useCallback, useMemo } from 'react';
import DenyModal from './DenyModal';
import ApproveModal from './ApproveModal';
import RevokeModal from './RevokeModal';
import StatsCards from './StatsCards';
import Toast from './Toast';
import { useToast } from '@/hooks/useToast';
import { formatDate, formatCost, formatTimeRange } from '@/lib/utils';
import { apiUrl } from '@/lib/api';

const STATUS_META = {
	pending:  { label: 'Pending' },
	approved: { label: 'Approved' },
	denied:   { label: 'Denied' },
};

export default function EventsTable({ events: initialEvents, organizations }) {
	const [events, setEvents]           = useState(initialEvents);
	const [activeTab, setActiveTab]     = useState('partner');
	const [statusFilter, setStatusFilter] = useState('all');
	const [orgFilter, setOrgFilter]     = useState('all');
	const [search, setSearch]           = useState('');
	const [expandedId, setExpandedId]   = useState(null);
	const [denyTarget, setDenyTarget]   = useState(null);
	const [approveTarget, setApproveTarget] = useState(null);
	const [revokeTarget, setRevokeTarget]   = useState(null);
	const [loadingId, setLoadingId]     = useState(null);
	const { toasts, addToast, dismissToast } = useToast();

	const partnerEvents = useMemo(() => events.filter(e => e.org_id != null), [events]);
	const viewerEvents  = useMemo(() => events.filter(e => e.org_id == null), [events]);

	const partnerPending = useMemo(() => partnerEvents.filter(e => e.status === 'pending').length, [partnerEvents]);
	const viewerPending  = useMemo(() => viewerEvents.filter(e => e.status === 'pending').length, [viewerEvents]);

	const stats = useMemo(() => ({
		pending:  events.filter(e => e.status === 'pending').length,
		approved: events.filter(e => e.status === 'approved').length,
		denied:   events.filter(e => e.status === 'denied').length,
		total:    events.length,
	}), [events]);

	const tabEvents = activeTab === 'partner' ? partnerEvents : viewerEvents;

	const filtered = tabEvents.filter(e => {
		const matchStatus = statusFilter === 'all' || e.status === statusFilter;
		const matchOrg    = activeTab === 'viewer' || orgFilter === 'all' || String(e.org_id) === orgFilter;
		const query = search.toLowerCase();
		const tagNames = Array.isArray(e.tag_names) ? e.tag_names : [];
		const matchSearch = search === ''
			|| e.title.toLowerCase().includes(query)
			|| tagNames.some(tag => tag.toLowerCase().includes(query));
		return matchStatus && matchOrg && matchSearch;
	});

	function switchTab(tab) {
		setActiveTab(tab);
		setStatusFilter('all');
		setOrgFilter('all');
		setSearch('');
		setExpandedId(null);
	}

	function updateEvent(eventId, patch) {
		setEvents(prev => prev.map(e => e.event_id === eventId ? { ...e, ...patch } : e));
	}

	const handleApprove = useCallback(async (eventId, title) => {
		setLoadingId(eventId);
		setApproveTarget(null);
		try {
			const res  = await fetch(apiUrl(`/api/events/${eventId}/approve`), { method: 'POST' });
			const data = await res.json();
			if (data.success) {
				updateEvent(eventId, { status: 'approved', admin_comment: null });
				addToast(`"${title}" has been approved and published.`, 'success');
			} else {
				addToast('Error: ' + data.message, 'error');
			}
		} catch {
			addToast('Network error. Please try again.', 'error');
		} finally {
			setLoadingId(null);
		}
	}, []);

	const handleDeny = useCallback(async (eventId, title, comment) => {
		setLoadingId(eventId);
		setDenyTarget(null);
		try {
			const res  = await fetch(apiUrl(`/api/events/${eventId}/deny`), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ comment }),
			});
			const data = await res.json();
			if (data.success) {
				updateEvent(eventId, { status: 'denied', admin_comment: comment });
				addToast(`"${title}" has been denied.`, 'error');
			} else {
				addToast('Error: ' + data.message, 'error');
			}
		} catch {
			addToast('Network error. Please try again.', 'error');
		} finally {
			setLoadingId(null);
		}
	}, []);

	const handleRevoke = useCallback(async (eventId, title) => {
		setLoadingId(eventId);
		setRevokeTarget(null);
		try {
			const res  = await fetch(apiUrl(`/api/events/${eventId}/revoke`), { method: 'POST' });
			const data = await res.json();
			if (data.success) {
				updateEvent(eventId, { status: 'pending', admin_comment: null });
				addToast(`"${title}" has been revoked and returned to pending.`, 'success');
			} else {
				addToast('Error: ' + data.message, 'error');
			}
		} catch {
			addToast('Network error. Please try again.', 'error');
		} finally {
			setLoadingId(null);
		}
	}, []);

	return (
		<>
			<StatsCards
				stats={stats}
				onFilter={setStatusFilter}
				activeFilter={statusFilter}
			/>
			<div className="tabs" role="tablist" aria-label="Event submission type">
				<button
					role="tab"
					aria-selected={activeTab === 'partner'}
					className={`tab-btn${activeTab === 'partner' ? ' tab-active' : ''}`}
					onClick={() => switchTab('partner')}
				>
					Partner Events
					{activeTab === 'viewer' && partnerPending > 0 && (
						<span className="tab-badge" aria-label={`${partnerPending} pending partner submissions`}>
							{partnerPending}
						</span>
					)}
				</button>
				<button
					role="tab"
					aria-selected={activeTab === 'viewer'}
					className={`tab-btn${activeTab === 'viewer' ? ' tab-active' : ''}`}
					onClick={() => switchTab('viewer')}
				>
					Viewer Events
					{activeTab === 'partner' && viewerPending > 0 && (
						<span className="tab-badge" aria-label={`${viewerPending} pending viewer submissions`}>
							{viewerPending}
						</span>
					)}
				</button>
			</div>

			<div className="filter-bar" aria-label="Filter events">
				<label htmlFor="event-search">Search:</label>
				<input
					id="event-search"
					type="search"
					value={search}
					onChange={e => setSearch(e.target.value)}
					placeholder="Filter by title or tag…"
					className="search-input"
					aria-label="Search events by title or tag"
				/>

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

				{activeTab === 'partner' && (
					<>
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
					</>
				)}

				<span className="result-count" aria-live="polite" aria-atomic="true">
					{filtered.length} {filtered.length === 1 ? 'event' : 'events'}
				</span>
			</div>

			<div className="table-wrapper">
				<table className="data-table">
					<caption className="table-caption">
						{activeTab === 'partner' ? 'Partner' : 'Viewer'} event submissions — {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
					</caption>
					<thead>
						<tr>
							<th scope="col">Event</th>
							<th scope="col">Date &amp; Time</th>
							<th scope="col">Location</th>
							<th scope="col">Audience &amp; Tags</th>
							<th scope="col">Cost</th>
							<th scope="col">Submitted</th>
							<th scope="col">Actions</th>
						</tr>
					</thead>
					<tbody>
						{filtered.map(event => {
							const isLoading  = loadingId === event.event_id;
							const statusMeta = STATUS_META[event.status];
							const visibleTags = event.tag_names?.slice(0, 2) ?? [];
							const hasMoreTags = (event.tag_names?.length ?? 0) > visibleTags.length;
							return (
								<React.Fragment key={event.event_id}>
									<tr className="event-row">
										<td>
											<div className="event-summary">
												<span
													className={`status-dot status-dot-${event.status}`}
													aria-label={`Status: ${statusMeta?.label ?? event.status}`}
													title={statusMeta?.label ?? event.status}
												/>
												<div className="event-summary-content">
													<strong>{event.title}</strong>
													<small>
														{activeTab === 'partner'
															? (event.org_name || 'Unknown organization')
															: (event.submitter_name || 'Unknown submitter')
														}
													</small>
													{event.contact_email && <small>{event.contact_email}</small>}
													{event.event_link && (
														<a
															href={event.event_link}
															target="_blank"
															rel="noopener noreferrer"
															aria-label={`${event.title} — external event link (opens in new tab)`}
														>
															Event Link
														</a>
													)}
												</div>
											</div>
										</td>
										<td>
											{formatDate(event.start_datetime)}
											<br />
											<small>{formatTimeRange(event.start_datetime, event.end_datetime)}</small>
											{event.end_datetime && formatDate(event.end_datetime) !== formatDate(event.start_datetime) && (
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
										<td>
											{event.audience}
											<br />
											<small>
												{visibleTags.length ? visibleTags.join(', ') : 'No tags'}
												{hasMoreTags ? ', ...' : ''}
											</small>
										</td>
										<td>{formatCost(event.cost)}</td>
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
													onClick={() => setRevokeTarget(event)}
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
											<td colSpan={7}>
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
								<td colSpan={7} className="no-data">
									No {activeTab === 'partner' ? 'partner' : 'viewer'} events match the selected filters.
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
			{revokeTarget && (
				<RevokeModal
					event={revokeTarget}
					onRevoke={() => handleRevoke(revokeTarget.event_id, revokeTarget.title)}
					onClose={() => setRevokeTarget(null)}
				/>
			)}

			<Toast toasts={toasts} onDismiss={dismissToast} />
		</>
	);
}
