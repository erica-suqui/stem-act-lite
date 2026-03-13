import pool from '@/lib/db';
import UsersTable from './UsersTable';
import { Box, Typography } from '@mui/material';

export const metadata = {
	title: 'User Management — STEM-ACT Admin',
};

export const dynamic = 'force-dynamic';

async function getUsers() {
	const result = await pool.query(`
		SELECT
			u.user_id,
			u.email,
			u.role,
			o.org_name
		FROM users u
		LEFT JOIN organizations o ON o.org_id = u.org_id
		ORDER BY u.user_id DESC
	`);
	return result.rows;
}

export default async function UsersPage() {
	const users = await getUsers();

	return (
		<Box sx={{ p: 3 }}>
			<Typography variant="h5" fontWeight={700} color="primary.dark" gutterBottom>
				User Management
			</Typography>
			<UsersTable users={users} />
		</Box>
	);
}
