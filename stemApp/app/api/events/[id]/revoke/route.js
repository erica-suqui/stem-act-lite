import { NextResponse } from 'next/server';

export async function POST(_, { params }) {
	const { id } = await params;
	const eventId = parseInt(id, 10);

	if (isNaN(eventId)) {
		return NextResponse.json({ success: false, message: 'Invalid event ID' }, { status: 400 });
	}

	return NextResponse.json({ success: true });
}
