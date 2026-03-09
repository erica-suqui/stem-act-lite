import { mockOrganizations, mockEvents } from '@/lib/mockData';
import PartnersTable from './PartnersTable';

export const metadata = {
	title: 'Partner Organizations — STEM-ACT Admin',
};

export default function PartnersPage() {
	const organizations = mockOrganizations.map(org => ({
		...org,
		event_count: mockEvents.filter(e => e.org_id === org.org_id).length,
		pending_count: mockEvents.filter(e => e.org_id === org.org_id && e.status === 'pending').length,
		approved_count: mockEvents.filter(e => e.org_id === org.org_id && e.status === 'approved').length,
		denied_count: mockEvents.filter(e => e.org_id === org.org_id && e.status === 'denied').length,
	}));

	const stats = {
		total: organizations.length,
		active: organizations.filter(o => o.status === 'active').length,
		pending: organizations.filter(o => o.status === 'pending').length,
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

			<PartnersTable organizations={organizations} />
		</main>
	);
}
