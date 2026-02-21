'use client';

import { mockEvents, mockOrganizations } from '@/lib/mockData';
import EventsTable from './components/EventsTable';
import StatsCards from './components/StatsCards';
import OrganizationsTable from './components/OrganizationsTable';

export default function Dashboard() {
	const events = mockEvents;
	const organizations = mockOrganizations;

	const stats = {
		pending:  events.filter(e => e.status === 'pending').length,
		approved: events.filter(e => e.status === 'approved').length,
		denied:   events.filter(e => e.status === 'denied').length,
		total:    events.length,
	};

	return (
		<main className="dashboard">
			<h1 className="page-title">Event Submissions</h1>
			<StatsCards stats={stats} />
			<EventsTable
				events={events}
				organizations={organizations}
			/>

			<h2>Partner Organizations</h2>
			<OrganizationsTable organizations={organizations} />
		</main>
	);
}
