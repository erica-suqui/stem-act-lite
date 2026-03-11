import pool from '@/lib/db';
import EventsTable from '../components/EventsTable';

export const dynamic = 'force-dynamic';





async function getEvents() {
	const result = await pool.query(`
		SELECT e.*, e.created_at AS submitted_at, o.org_name
		FROM events e
		LEFT JOIN organizations o ON e.org_id = o.org_id
		ORDER BY e.created_at DESC
	`);
	return result.rows;
}

async function getOrganizations() {
	const result = await pool.query(`
		SELECT * FROM organizations ORDER BY org_name
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
