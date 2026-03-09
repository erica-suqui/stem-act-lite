import { mockUsers } from '@/lib/mockData';
import UsersTable from './UsersTable';

export const metadata = {
	title: 'User Management — STEM-ACT Admin',
};

export default function UsersPage() {
	const users = mockUsers;

	return (
		<main className="dashboard">
			<h1 className="page-title">User Management</h1>

			<UsersTable users={users} />
		</main>
	);
}
