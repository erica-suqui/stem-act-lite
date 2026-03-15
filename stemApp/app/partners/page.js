import pool from '@/lib/db';
import PartnersTable from './PartnersTable';
import { Box, Typography } from '@mui/material';
import { hasSplitContactNameColumns } from '@/lib/dbFeatures';

export const metadata = {
	title: 'Partner Organizations — STEM-ACT Admin',
};

export const dynamic = 'force-dynamic';

async function getOrganizations() {
	const splitNamesEnabled = await hasSplitContactNameColumns();
	const result = await pool.query(
		splitNamesEnabled
			? `
				SELECT
					o.org_id,
					o.org_name,
					o.contact_first_name,
					o.contact_last_name,
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
			`
			: `
				SELECT
					o.org_id,
					o.org_name,
					split_part(COALESCE(o.contact_name, ''), ' ', 1) AS contact_first_name,
					CASE
						WHEN position(' ' IN COALESCE(o.contact_name, '')) > 0
							THEN NULLIF(substring(COALESCE(o.contact_name, '') FROM position(' ' IN COALESCE(o.contact_name, '')) + 1), '')
						ELSE NULL
					END AS contact_last_name,
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
			`,
	);

	return result.rows.map(org => ({
		...org,
		contact_name: [org.contact_first_name, org.contact_last_name].filter(Boolean).join(' ').trim(),
		event_count: Number(org.event_count || 0),
		pending_count: Number(org.pending_count || 0),
		approved_count: Number(org.approved_count || 0),
		denied_count: Number(org.denied_count || 0),
	}));
}

export default async function PartnersPage() {
	const organizations = await getOrganizations();

	return (
		<Box sx={{ p: 3 }}>
			<Typography variant="h5" fontWeight={700} color="primary.dark" gutterBottom>
				Partner Organizations
			</Typography>
			<PartnersTable organizations={organizations} />
		</Box>
	);
}
