import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request, { params }) {
	const { id } = await params;
	const userId = parseInt(id, 10);

	if (isNaN(userId)) {
		return NextResponse.json({ success: false, message: 'Invalid user ID' }, { status: 400 });
	}

	try {
		// Prevent deleting the last super_admin
		const superAdmins = await pool.query(
			"SELECT COUNT(*) FROM users WHERE role = 'super_admin'"
		);
		const target = await pool.query(
			'SELECT role FROM users WHERE user_id = $1',
			[userId]
		);

		if (target.rowCount === 0) {
			return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
		}

		if (
			target.rows[0].role === 'super_admin' &&
			parseInt(superAdmins.rows[0].count, 10) <= 1
		) {
			return NextResponse.json(
				{ success: false, message: 'Cannot delete the last super administrator.' },
				{ status: 403 }
			);
		}

		await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);

		return NextResponse.json({ success: true });
	} catch (err) {
		return NextResponse.json({ success: false, message: err.message }, { status: 500 });
	}
}
