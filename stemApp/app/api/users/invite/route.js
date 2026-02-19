import { NextResponse } from 'next/server';
import crypto from 'crypto';

// In production this token would be stored in the DB with an expiry.
// For Phase 1 prototype, we generate a signed token and return the invite link.
export async function POST(request) {
	let body;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
	}

	const { role } = body;
	if (!['admin', 'super_admin'].includes(role)) {
		return NextResponse.json(
			{ success: false, message: 'Role must be admin or super_admin' },
			{ status: 400 }
		);
	}

	// Generate a random invite token
	const token = crypto.randomBytes(24).toString('hex');
	const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48 hours

	// TODO: store token in an invitations table when implemented
	const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/register?token=${token}&role=${role}`;

	return NextResponse.json({ success: true, inviteLink, expiresAt });
}
