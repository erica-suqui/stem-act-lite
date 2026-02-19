import pool from '@/lib/db';
import UsersTable from './UsersTable';

export const dynamic = 'force-dynamic';

export const metadata = {
	title: 'User Management — STEM-ACT Admin',
};

async function getUsers() {
	const result = await pool.query(`
		SELECT
			u.user_id,
			u.email,
			u.role,
			o.org_name
		FROM users u
		LEFT JOIN organizations o ON u.org_id = o.org_id
		ORDER BY
			CASE u.role
				WHEN 'super_admin' THEN 1
				WHEN 'admin'       THEN 2
				WHEN 'partner'     THEN 3
			END,
			u.email
	`);
	return result.rows;
}

export default async function UsersPage() {
	const users = await getUsers();

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

			<UsersTable users={JSON.parse(JSON.stringify(users))} />
		</main>
	);
}
