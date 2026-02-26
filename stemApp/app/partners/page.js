import { mockOrganizations, mockEvents } from '@/lib/mockData';
import PartnersTable from './PartnersTable';

export const metadata = {
	title: 'Partner Organizations — STEM-ACT Admin',
};

export default function PartnersPage() {
	const organizations = mockOrganizations.map(org => ({
		...org,
		event_count:    mockEvents.filter(e => e.org_id === org.org_id).length,
		pending_count:  mockEvents.filter(e => e.org_id === org.org_id && e.status === 'pending').length,
		approved_count: mockEvents.filter(e => e.org_id === org.org_id && e.status === 'approved').length,
		denied_count:   mockEvents.filter(e => e.org_id === org.org_id && e.status === 'denied').length,
	}));

	return (
		<main className="dashboard">
			<h1 className="page-title">Partner Organizations</h1>
			<PartnersTable organizations={organizations} />
		</main>
	);
}
