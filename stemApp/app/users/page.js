import { mockUsers } from '@/lib/mockData';
import UsersTable from './UsersTable';

export const metadata = {
	title: 'User Management — STEM-ACT Admin',
};

export default function UsersPage() {
	const users = mockUsers;

	const stats = {
		total:       users.length,
		superAdmins: users.filter(u => u.role === 'super_admin').length,
		admins:      users.filter(u => u.role === 'admin').length,
		partners:    users.filter(u => u.role === 'partner').length,
	};

	return (
		<main className="dashboard">
			<h1 className="page-title">User Management</h1>

			<div className="stats-grid">
				<div className="stat-card stat-total">
					<span className="stat-number">{stats.total}</span>
					<span className="stat-label">Total Users</span>
				</div>
				<div className="stat-card stat-approved">
					<span className="stat-number">{stats.superAdmins}</span>
					<span className="stat-label">Super Admins</span>
				</div>
				<div className="stat-card stat-pending">
					<span className="stat-number">{stats.admins}</span>
					<span className="stat-label">Admins</span>
				</div>
				<div className="stat-card stat-denied">
					<span className="stat-number">{stats.partners}</span>
					<span className="stat-label">Partners</span>
				</div>
			</div>

			<UsersTable users={users} />
		</main>
	);
}
