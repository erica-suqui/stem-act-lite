import pool from '@/lib/db';
import { parseIntParam, jsonError, jsonOk, parseBody } from '@/lib/apiHelpers';
import { VALID_ROLES } from '@/lib/constants';

export async function POST(request, { params }) {
	const { id } = await params;
	const userId = parseIntParam(id);
	if (isNaN(userId)) return jsonError('Invalid user ID');

	const { body, error } = await parseBody(request);
	if (error) return error;

	const { role } = body;
	if (!VALID_ROLES.includes(role)) return jsonError('Invalid role');

	try {
		// Enforce single super_admin rule
		if (role === 'super_admin') {
			const existing = await pool.query(
				"SELECT email FROM users WHERE role = 'super_admin' AND user_id != $1",
				[userId]
			);
			if (existing.rowCount > 0) {
				return jsonError(
					`${existing.rows[0].email} is already the super administrator. Remove their role first.`,
					409
				);
			}
		}

		const result = await pool.query(
			'UPDATE users SET role = $1 WHERE user_id = $2 RETURNING user_id',
			[role, userId]
		);

		if (result.rowCount === 0) return jsonError('User not found', 404);

		return jsonOk();
	} catch (err) {
		return jsonError(err.message, 500);
	}
}
