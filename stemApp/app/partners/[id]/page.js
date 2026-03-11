import { notFound } from 'next/navigation';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatDate, formatFullName, formatTimeRange } from '@/lib/utils';
import pool from '@/lib/db';

const STATUS_META = {
	pending:  { Icon: Clock,        label: 'Pending',  className: 'status-pending' },
	approved: { Icon: CheckCircle,  label: 'Approved', className: 'status-approved' },
	denied:   { Icon: XCircle,      label: 'Denied',   className: 'status-denied' },
	rejected: { Icon: XCircle,      label: 'Rejected', className: 'status-denied' },
};

export const dynamic = 'force-dynamic';

async function getOrganization(orgId) {
	const result = await pool.query(
		`
		SELECT
			org_id,
			org_name,
			contact_first_name,
			contact_last_name,
			contact_email,
			contact_phone,
			CASE
				WHEN status = 'approved' THEN 'active'
				WHEN status IN ('rejected', 'inactive') THEN 'disabled'
				ELSE status
			END AS status
		FROM organizations
		WHERE org_id = $1
		LIMIT 1
		`,
		[orgId],
	);
	if (!result.rows[0]) return null;

	return {
		...result.rows[0],
		contact_name: formatFullName(
			result.rows[0].contact_first_name,
			result.rows[0].contact_last_name,
		),
	};
}

async function getOrganizationEvents(orgId) {
	const result = await pool.query(
		`
		SELECT
			event_id,
			org_id,
			title,
			start_datetime,
			end_datetime,
			address,
			city,
			county,
			status,
			hyperlink AS event_link,
			event_contact AS contact_email,
			COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tag_names,
			created_at AS submitted_at
		FROM events e
		LEFT JOIN event_tags et ON et.event_id = e.event_id
		LEFT JOIN tags t ON t.tag_id = et.tag_id
		WHERE org_id = $1
		GROUP BY e.event_id
		ORDER BY created_at DESC
		`,
		[orgId],
	);
	return result.rows;
}

export async function generateMetadata({ params }) {
	const { id } = await params;
	const org = await getOrganization(Number(id));
	return {
		title: org ? `${org.org_name} — STEM-ACT Admin` : 'Partner Not Found',
	};
}

export default async function PartnerDetailPage({ params }) {
	const { id } = await params;
	const org = await getOrganization(Number(id));
	if (!org) notFound();

	const events = await getOrganizationEvents(org.org_id);

	const pending  = events.filter(e => e.status === 'pending').length;
	const approved = events.filter(e => e.status === 'approved').length;
	const denied   = events.filter(e => e.status === 'denied').length;

	return (
		<main className="dashboard">
			<h1 className="page-title">{org.org_name}</h1>

			<div className="org-detail-card">
				<dl className="org-detail-grid">
					<dt>Contact Name</dt>
					<dd>{org.contact_name}</dd>

					<dt>Email</dt>
					<dd>
						<a href={`mailto:${org.contact_email}`}>{org.contact_email}</a>
					</dd>

					<dt>Phone</dt>
					<dd>{org.contact_phone || '—'}</dd>

					<dt>Status</dt>
					<dd>
						<span className={`status-badge status-${org.status}`}>
							{org.status.charAt(0).toUpperCase() + org.status.slice(1)}
						</span>
					</dd>
				</dl>
			</div>

			<h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '2rem 0 1rem', color: '#1a1a2e' }}>
				Event Submissions
			</h2>

			<div className="stats-grid">
				<div className="stat-card stat-total">
					<span className="stat-number">{events.length}</span>
					<span className="stat-label">Total</span>
				</div>
				<div className="stat-card stat-pending">
					<span className="stat-number">{pending}</span>
					<span className="stat-label">Pending</span>
				</div>
				<div className="stat-card stat-approved">
					<span className="stat-number">{approved}</span>
					<span className="stat-label">Approved</span>
				</div>
				<div className="stat-card stat-denied">
					<span className="stat-number">{denied}</span>
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
											{event.tag_names.length > 0 && (
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
