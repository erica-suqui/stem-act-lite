import pool from '@/lib/db';
import PartnersTable from './PartnersTable';

export const metadata = {
	title: 'Partner Organizations — STEM-ACT Admin',
};

export const dynamic = 'force-dynamic';

async function getOrganizations() {
	const result = await pool.query(`
		SELECT
			o.org_id,
			o.org_name,
			o.contact_name,
			o.contact_email,
			o.contact_phone,
			CASE
				WHEN o.status = 'approved' THEN 'active'
				WHEN o.status IN ('rejected', 'inactive') THEN 'disabled'
				ELSE o.status
			END AS status,
			COUNT(e.event_id) AS event_count,
			COUNT(*) FILTER (WHERE e.status = 'pending') AS pending_count,
			COUNT(*) FILTER (WHERE e.status = 'approved') AS approved_count,
			COUNT(*) FILTER (WHERE e.status IN ('denied', 'rejected')) AS denied_count
		FROM organizations o
		LEFT JOIN events e ON e.org_id = o.org_id
		GROUP BY o.org_id
		ORDER BY o.org_name
	`);

	return result.rows.map(org => ({
		...org,
		event_count: Number(org.event_count || 0),
		pending_count: Number(org.pending_count || 0),
		approved_count: Number(org.approved_count || 0),
		denied_count: Number(org.denied_count || 0),
	}));
}

export default async function PartnersPage() {
	const organizations = await getOrganizations();

	return (
		<main className="dashboard">
			<h1 className="page-title">Partner Organizations</h1>
			<PartnersTable organizations={organizations} />
		</main>
	);
}
