import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const VALID_ROLES = ['super_admin', 'admin', 'partner'];

export async function POST(request, { params }) {
	const { id } = await params;
	const userId = parseInt(id, 10);

	if (isNaN(userId)) {
		return NextResponse.json({ success: false, message: 'Invalid user ID' }, { status: 400 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
	}

	const { role } = body;

	if (!VALID_ROLES.includes(role)) {
		return NextResponse.json({ success: false, message: 'Invalid role' }, { status: 400 });
	}

	try {
		// Enforce single super_admin rule
		if (role === 'super_admin') {
			const existing = await pool.query(
				"SELECT email FROM users WHERE role = 'super_admin' AND user_id != $1",
				[userId]
			);
			if (existing.rowCount > 0) {
				return NextResponse.json(
					{ success: false, message: `${existing.rows[0].email} is already the super administrator. Remove their role first.` },
					{ status: 409 }
				);
			}
		}

		const result = await pool.query(
			'UPDATE users SET role = $1 WHERE user_id = $2 RETURNING user_id',
			[role, userId]
		);

		if (result.rowCount === 0) {
			return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
		}

		return NextResponse.json({ success: true });
	} catch (err) {
		return NextResponse.json({ success: false, message: err.message }, { status: 500 });
	}
}
