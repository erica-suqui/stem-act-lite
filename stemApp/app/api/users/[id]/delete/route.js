import pool from '@/lib/db';
import { parseIntParam, jsonError, jsonOk } from '@/lib/apiHelpers';

export async function POST(_, { params }) {
	const { id } = await params;
	const userId = parseIntParam(id);
	if (isNaN(userId)) return jsonError('Invalid user ID');

	try {
		const [superAdmins, target] = await Promise.all([
			pool.query("SELECT COUNT(*) FROM users WHERE role = 'super_admin'"),
			pool.query('SELECT role FROM users WHERE user_id = $1', [userId]),
		]);

		if (target.rowCount === 0) return jsonError('User not found', 404);

		if (
			target.rows[0].role === 'super_admin' &&
			parseInt(superAdmins.rows[0].count, 10) <= 1
		) {
			return jsonError('Cannot delete the last super administrator.', 403);
		}

		await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);

		return jsonOk();
	} catch (err) {
		return jsonError(err.message, 500);
	}
}
