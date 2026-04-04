'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatDate, formatFullName, formatTimeRange } from '@/lib/utils';
import { apiUrl } from '@/lib/api';
import SendMessageButton from '@/app/components/SendMessage';

const STATUS_META = {
	pending:  { Icon: Clock,        label: 'Pending',  className: 'status-pending' },
	active:   { Icon: CheckCircle,  label: 'Active',   className: 'status-approved' },
	disabled: { Icon: XCircle,      label: 'Disabled', className: 'status-denied' },
	denied:   { Icon: XCircle,      label: 'Denied',   className: 'status-denied' },
};

const formatPhone = (phone) => {
    if (!phone) return '—';
    const digits = phone.replace(/\D/g, '');
    return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,10)}`;
};

export default function PartnerDetailPage() {
	const { id } = useParams();
	const [org, setOrg] = useState(null);
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);

	useEffect(() => {
		if (!id) return;
		Promise.all([
			fetch(apiUrl(`/api/organizations/${id}`)).then(r => r.json()),
			fetch(apiUrl(`/api/events?org_id=${id}`)).then(r => r.json()),
		]).then(([orgData, eventsData]) => {
			if (!orgData.success) { setNotFound(true); return; }
			const o = orgData.organization;
			setOrg({
				...o,
				contact_name: formatFullName(o.contact_first_name, o.contact_last_name),
			});
			setEvents(eventsData.events ?? []);
		}).finally(() => setLoading(false));
	}, [id]);

	if (loading) return <main className="dashboard"><p>Loading…</p></main>;
	if (notFound) return <main className="dashboard"><p>Partner not found.</p></main>;

	const pending  = events.filter(e => e.status === 'pending').length;
	const approved = events.filter(e => e.status === 'approved').length;
	const denied   = events.filter(e => e.status === 'denied').length;

	return (
		<main className="dashboard">
			<h1 className="page-title">{org.org_name}</h1>

			<div className="org-detail-card">
				<dl className="org-detail-grid">
					<dt><strong>Contact Name: </strong> {org.contact_name} </dt>

					<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
						<dt><strong>Email:</strong></dt>
						<dd>
							<a href={`mailto:${org.contact_email}`} aria-label={`Email ${org.org_name} at ${org.contact_email}`}>{org.contact_email}</a>
						</dd>
					</div>

					<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
					<dt><strong>Phone:</strong></dt>
					<dd>{formatPhone(org.contact_phone)}</dd>
					</div>

					<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
					<dt><strong>Status: </strong></dt>
					<dd>
						<span className={`status-badge status-${org.status}`}>
							{org.status.charAt(0).toUpperCase() + org.status.slice(1)}
						</span>
					</dd>
					</div>
				</dl>
				<SendMessageButton orgId={org.org_id} orgName={org.org_name} />

			</div>


			<h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '2rem 0 1rem', color: '#1a1a2e' }}>
				Event Submissions
			</h2>

			<div className="stats-grid">
				<div className="stat-card stat-total">
					<span className="stat-number" aria-label={`${events.length} total events`}>{events.length+" "}</span>
					<span className="stat-label">Total</span>
				</div>
				<div className="stat-card stat-pending">
					<span className="stat-number">{pending+" "}</span>
					<span className="stat-label">Pending</span>
				</div>
				<div className="stat-card stat-approved">
					<span className="stat-number">{approved+" "}</span>
					<span className="stat-label">Approved</span>
				</div>
				<div className="stat-card stat-denied">
					<span className="stat-number">{denied + " "}</span>
					<span className="stat-label">Denied</span>
				</div>
			</div>
			{events.length === 0 ? (
				<p className="no-data" style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
					This organization has not submitted any events yet.
				</p>
			) : (
				<div className="table-wrapper">
					<table className="data-table">
						<caption className="table-caption">
							Event submissions from {org.org_name} — {events.length} {events.length === 1 ? 'result' : 'results'}
						</caption>
						<thead>
							<tr>
								<th scope="col">Event Title</th>
								<th scope="col">Contact</th>
								<th scope="col">Date</th>
								<th scope="col">Time</th>
								<th scope="col">Location</th>
								<th scope="col">Status</th>
								<th scope="col">Submitted</th>
							</tr>
						</thead>
						<tbody>
							{events.map(event => {
								const meta     = STATUS_META[event.status];
								const StatusIcon = meta?.Icon;
								return (
									<tr key={event.event_id}>
										<td>
											<strong>{event.title}</strong>
											{event.event_link && (
												<>
													<br />
													<a
														href={event.event_link}
														target="_blank"
														rel="noopener noreferrer"
														aria-label={`${event.title} — external link (opens in new tab)`}
													>
														Event Link
													</a>
												</>
											)}
										</td>
										<td>
											<small>{event.contact_email}</small>
											{event.tag_names?.length > 0 && (
												<>
													<br />
													<small>{event.tag_names.join(', ')}</small>
												</>
											)}
										</td>
										<td>
											{formatDate(event.start_datetime)}
											{event.end_datetime && formatDate(event.end_datetime) !== formatDate(event.start_datetime) && (
												<>
													<br />
													<small>to {formatDate(event.end_datetime)}</small>
												</>
											)}
										</td>
										<td>{formatTimeRange(event.start_datetime, event.end_datetime)}</td>
										<td>
											{event.city}, {event.county}
											<br />
											<small>{event.address}</small>
										</td>
										<td>
											<span className={`status-badge ${meta?.className ?? ''}`}>
												{StatusIcon && (
													<StatusIcon size={12} aria-hidden="true" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
												)}
												{meta?.label ?? event.status}
											</span>
										</td>
										<td>{formatDate(event.submitted_at)}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</main>
	);
}
