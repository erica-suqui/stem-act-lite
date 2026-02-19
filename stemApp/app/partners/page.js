import pool from '@/lib/db';
import PartnersTable from './PartnersTable';

export const dynamic = 'force-dynamic';

export const metadata = {
	title: 'Partner Organizations — STEM-ACT Admin',
};

async function getOrganizations() {
	const result = await pool.query(`
		SELECT
			o.*,
			COUNT(e.event_id)                                        AS event_count,
			COUNT(e.event_id) FILTER (WHERE e.status = 'pending')   AS pending_count,
			COUNT(e.event_id) FILTER (WHERE e.status = 'approved')  AS approved_count,
			COUNT(e.event_id) FILTER (WHERE e.status = 'denied')    AS denied_count
		FROM organizations o
		LEFT JOIN events e ON e.org_id = o.org_id
		GROUP BY o.org_id
		ORDER BY o.org_name
	`);
	return result.rows;
}

export default async function PartnersPage() {
	const organizations = await getOrganizations();

	const stats = {
		total:    organizations.length,
		active:   organizations.filter(o => o.status === 'active').length,
		pending:  organizations.filter(o => o.status === 'pending').length,
		disabled: organizations.filter(o => o.status === 'disabled').length,
	};

	return (
		<main className="dashboard">
			<h1 className="page-title">Partner Organizations</h1>

			<div className="stats-grid">
				<div className="stat-card stat-total">
					<span className="stat-number">{stats.total}</span>
					<span className="stat-label">Total</span>
				</div>
				<div className="stat-card stat-approved">
					<span className="stat-number">{stats.active}</span>
					<span className="stat-label">Active</span>
				</div>
				<div className="stat-card stat-pending">
					<span className="stat-number">{stats.pending}</span>
					<span className="stat-label">Pending</span>
				</div>
				<div className="stat-card stat-denied">
					<span className="stat-number">{stats.disabled}</span>
					<span className="stat-label">Disabled</span>
				</div>
			</div>

			<PartnersTable organizations={JSON.parse(JSON.stringify(organizations))} />
		</main>
	);
}
