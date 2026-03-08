// In production this token would be stored in the DB with an expiry.
// For Phase 1 prototype, we generate a signed token and return the invite link.
import crypto from 'crypto';
import { jsonError, jsonOk, parseBody } from '@/lib/apiHelpers';
import { VALID_INVITE_ROLES } from '@/lib/constants';

export async function POST(request) {
	const { body, error } = await parseBody(request);
	if (error) return error;

	const { role } = body;
	if (!VALID_INVITE_ROLES.includes(role)) {
		return jsonError(`Role must be one of: ${VALID_INVITE_ROLES.join(', ')}`);
	}

	const token     = crypto.randomBytes(24).toString('hex');
	const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48 hours

	// TODO: store token in an invitations table when implemented
	const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/register?token=${token}&role=${role}`;

	return jsonOk({ inviteLink, expiresAt });
}
