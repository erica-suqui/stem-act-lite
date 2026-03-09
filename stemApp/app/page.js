'use client';

import { mockEvents, mockOrganizations } from '@/lib/mockData';
import EventsTable from './components/EventsTable';
import OrganizationsTable from './components/OrganizationsTable';

export default function Dashboard() {
	const events = mockEvents;
	const organizations = mockOrganizations;

	return (
		<main className="dashboard">
			<h1 className="page-title">Event Submissions</h1>
			<EventsTable
				events={events}
				organizations={organizations}
			/>

			<h2>Partner Organizations</h2>
			<OrganizationsTable organizations={organizations} />
		</main>
	);
}
