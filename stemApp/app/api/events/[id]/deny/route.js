import { NextResponse } from 'next/server';

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

	return NextResponse.json({ success: true });
}
