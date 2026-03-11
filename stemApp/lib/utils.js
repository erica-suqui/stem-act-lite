// Shared utility functions — safe to import on both server and client.

export function formatDate(dateStr) {
	return new Date(dateStr).toLocaleDateString('en-US', {
		month: 'short', day: 'numeric', year: 'numeric',
	});
}

export function formatTime(dateStr) {
	return new Date(dateStr).toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
	});
}

export function formatDateTimeRange(startStr, endStr) {
	const start = new Date(startStr);
	const end = endStr ? new Date(endStr) : null;

	const sameDay = end && start.toDateString() === end.toDateString();

	return {
		primary: `${formatDate(startStr)} at ${formatTime(startStr)}`,
		secondary: end
			? sameDay
				? `to ${formatTime(endStr)}`
				: `to ${formatDate(endStr)} at ${formatTime(endStr)}`
			: null,
	};
}

export function formatTimeRange(startStr, endStr) {
	const start = new Date(startStr);
	const end = endStr ? new Date(endStr) : null;

	if (!end) {
		return formatTime(startStr);
	}

	const sameDay = start.toDateString() === end.toDateString();
	return sameDay
		? `${formatTime(startStr)} to ${formatTime(endStr)}`
		: `${formatTime(startStr)} to ${formatDate(endStr)} at ${formatTime(endStr)}`;
}

export function formatCost(cost) {
	const num = parseFloat(cost);
	return num === 0 ? 'Free' : `$${num.toFixed(2)}`;
}

export function formatFullName(firstName, lastName) {
	return [firstName, lastName].filter(Boolean).join(' ').trim() || '—';
}
