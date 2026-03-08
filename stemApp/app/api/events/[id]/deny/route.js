import { parseIntParam, jsonError, jsonOk, parseBody } from '@/lib/apiHelpers';

export async function POST(request, { params }) {
	const { id } = await params;
	const eventId = parseIntParam(id);
	if (isNaN(eventId)) return jsonError('Invalid event ID');

	const { body, error } = await parseBody(request);
	if (error) return error;

	const { comment } = body;
	if (!comment || !comment.trim()) {
		return jsonError('Comment is required when denying an event');
	}

	return jsonOk();
}
