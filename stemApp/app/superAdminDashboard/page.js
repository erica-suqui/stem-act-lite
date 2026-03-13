import pool from '@/lib/db';
import EventsTable from '../components/EventsTable';
import PartnerCodesAdmin from '../components/PartnerCodesAdmin';
import { Box, Typography } from '@mui/material';
import { hasEventTagTables, hasSplitContactNameColumns } from '@/lib/dbFeatures';

export const dynamic = 'force-dynamic';





async function getEvents() {
	const tagsEnabled = await hasEventTagTables();
	const result = await pool.query(
		tagsEnabled
			? `
				SELECT
					e.*,
					e.created_at AS submitted_at,
					o.org_name,
					COALESCE(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tag_names
				FROM events e
				LEFT JOIN organizations o ON e.org_id = o.org_id
				LEFT JOIN event_tags et ON et.event_id = e.event_id
				LEFT JOIN tags t ON t.tag_id = et.tag_id
				GROUP BY e.event_id, o.org_name
				ORDER BY e.created_at DESC
			`
			: `
				SELECT
					e.*,
					e.created_at AS submitted_at,
					o.org_name,
					ARRAY[]::TEXT[] AS tag_names
				FROM events e
				LEFT JOIN organizations o ON e.org_id = o.org_id
				ORDER BY e.created_at DESC
			`,
	);
	return result.rows;
}

async function getOrganizations() {
	const splitNamesEnabled = await hasSplitContactNameColumns();
	const result = await pool.query(
		splitNamesEnabled
			? `
				SELECT
					org_id,
					org_name,
					contact_first_name,
					contact_last_name,
					contact_email,
					contact_phone,
					status
				FROM organizations
				ORDER BY org_name
			`
			: `
				SELECT
					org_id,
					org_name,
					split_part(COALESCE(contact_name, ''), ' ', 1) AS contact_first_name,
					CASE
						WHEN position(' ' IN COALESCE(contact_name, '')) > 0
							THEN NULLIF(substring(COALESCE(contact_name, '') FROM position(' ' IN COALESCE(contact_name, '')) + 1), '')
						ELSE NULL
					END AS contact_last_name,
					contact_email,
					contact_phone,
					status
				FROM organizations
				ORDER BY org_name
			`,
	);
	return result.rows;
}

export default async function Dashboard() {
	const events = await getEvents();
	const organizations = await getOrganizations();

	return (
		<Box sx={{ p: 3 }}>
			<Typography variant="h5" fontWeight={700} color="primary.dark" gutterBottom>
				Event Submissions
			</Typography>
			<EventsTable
				events={JSON.parse(JSON.stringify(events))}
				organizations={JSON.parse(JSON.stringify(organizations))}
			/>
			<Box sx={{ mt: 4 }}>
				<PartnerCodesAdmin />
			</Box>
		</Box>
	);
}
