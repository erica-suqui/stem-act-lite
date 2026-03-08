import pool from '@/lib/db';
import { parseIntParam, jsonError, jsonOk, parseBody } from '@/lib/apiHelpers';
import { VALID_ORG_STATUSES } from '@/lib/constants';

export async function POST(request, { params }) {
	const { id } = await params;
	const orgId = parseIntParam(id);
	if (isNaN(orgId)) return jsonError('Invalid organization ID');

	const { body, error } = await parseBody(request);
	if (error) return error;

	const { status } = body;
	if (!VALID_ORG_STATUSES.includes(status)) {
		return jsonError(`Status must be one of: ${VALID_ORG_STATUSES.join(', ')}`);
	}

	try {
		const result = await pool.query(
			'UPDATE organizations SET status = $1 WHERE org_id = $2 RETURNING *',
			[status, orgId]
		);

		if (result.rowCount === 0) return jsonError('Organization not found', 404);

		return jsonOk({ organization: result.rows[0] });
	} catch (err) {
		return jsonError(err.message, 500);
	}
}
