import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request, { params }) {
	const { id } = await params;
	const eventId = parseInt(id, 10);

	if (isNaN(eventId)) {
		return NextResponse.json({ success: false, message: 'Invalid event ID' }, { status: 400 });
	}

	try {
		const result = await pool.query(
			'UPDATE events SET status = $1, admin_comment = NULL WHERE event_id = $2 RETURNING *',
			['approved', eventId]
		);

		if (result.rowCount === 0) {
			return NextResponse.json({ success: false, message: 'Event not found' }, { status: 404 });
		}

		return NextResponse.json({ success: true, event: result.rows[0] });
	} catch (err) {
		return NextResponse.json({ success: false, message: err.message }, { status: 500 });
	}
}
