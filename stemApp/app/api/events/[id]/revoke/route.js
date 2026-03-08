import { parseIntParam, jsonError, jsonOk } from '@/lib/apiHelpers';

export async function POST(_, { params }) {
	const { id } = await params;
	const eventId = parseIntParam(id);

	if (isNaN(eventId)) return jsonError('Invalid event ID');

	return jsonOk();
}
