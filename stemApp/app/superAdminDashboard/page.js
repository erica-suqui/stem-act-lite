import pool from '@/lib/db';
import EventsTable from '../components/EventsTable';
import StatsCards from '../components/StatsCards';
import OrganizationsTable from '../components/OrganizationsTable';

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

	const stats = {
		pending: events.filter(e => e.status === 'pending').length,
		approved: events.filter(e => e.status === 'approved').length,
		denied: events.filter(e => e.status === 'denied').length,
		total: events.length,
	};

	return (
		<main className="dashboard">
			<h1 className="page-title">Event Submissions</h1>
			<StatsCards stats={stats} />
			<EventsTable
				events={JSON.parse(JSON.stringify(events))}
				organizations={JSON.parse(JSON.stringify(organizations))}
			/>

			<h2>Partner Organizations</h2>
			<OrganizationsTable organizations={JSON.parse(JSON.stringify(organizations))} />
		</main>
	);
}
