// Shared helpers for Next.js API route handlers (server-only).
import { NextResponse } from 'next/server';

/** Parse a route param as a positive integer. Returns NaN if invalid. */
export function parseIntParam(value) {
	const n = parseInt(value, 10);
	return Number.isFinite(n) && n > 0 ? n : NaN;
}

/** Return a JSON error response. */
export function jsonError(message, status = 400) {
	return NextResponse.json({ success: false, message }, { status });
}

/** Return a JSON success response. */
export function jsonOk(data = {}) {
	return NextResponse.json({ success: true, ...data });
}

/**
 * Parse and validate a JSON request body.
 * Returns { body } on success or { error: Response } on failure.
 */
export async function parseBody(request) {
	try {
		const body = await request.json();
		return { body };
	} catch {
		return { error: jsonError('Invalid request body') };
	}
}
