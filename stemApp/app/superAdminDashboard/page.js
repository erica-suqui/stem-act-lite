import pool from '@/lib/db';
import EventsTable from '../components/EventsTable';

export const dynamic = 'force-dynamic';





async function getEvents() {
	const result = await pool.query(`
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
	`);
	return result.rows;
}

async function getOrganizations() {
	const result = await pool.query(`
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
	`);
	return result.rows;
}

export default async function Dashboard() {
	const events = await getEvents();
	const organizations = await getOrganizations();

	return (
		<main className="dashboard">
			<h1 className="page-title">Event Submissions</h1>
			<EventsTable
				events={JSON.parse(JSON.stringify(events))}
				organizations={JSON.parse(JSON.stringify(organizations))}
			/>
		</main>
	);
}
