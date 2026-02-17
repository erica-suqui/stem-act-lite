import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request, { params }) {
	const { id } = await params;
	const eventId = parseInt(id, 10);

	if (isNaN(eventId)) {
		return NextResponse.json({ success: false, message: 'Invalid event ID' }, { status: 400 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
	}

	const { comment } = body;
	if (!comment || !comment.trim()) {
		return NextResponse.json({ success: false, message: 'Comment is required when denying an event' }, { status: 400 });
	}

	try {
		const result = await pool.query(
			'UPDATE events SET status = $1, admin_comment = $2 WHERE event_id = $3 RETURNING *',
			['denied', comment.trim(), eventId]
		);

		if (result.rowCount === 0) {
			return NextResponse.json({ success: false, message: 'Event not found' }, { status: 404 });
		}

		return NextResponse.json({ success: true, event: result.rows[0] });
	} catch (err) {
		return NextResponse.json({ success: false, message: err.message }, { status: 500 });
	}
}
