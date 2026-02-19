import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const VALID_STATUSES = ['active', 'pending', 'disabled'];

export async function POST(request, { params }) {
	const { id } = await params;
	const orgId = parseInt(id, 10);

	if (isNaN(orgId)) {
		return NextResponse.json({ success: false, message: 'Invalid organization ID' }, { status: 400 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
	}

	const { status } = body;
	if (!VALID_STATUSES.includes(status)) {
		return NextResponse.json({ success: false, message: `Status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
	}

	try {
		const result = await pool.query(
			'UPDATE organizations SET status = $1 WHERE org_id = $2 RETURNING *',
			[status, orgId]
		);

		if (result.rowCount === 0) {
			return NextResponse.json({ success: false, message: 'Organization not found' }, { status: 404 });
		}

		return NextResponse.json({ success: true, organization: result.rows[0] });
	} catch (err) {
		return NextResponse.json({ success: false, message: err.message }, { status: 500 });
	}
}
