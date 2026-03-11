// Shared utility functions — safe to import on both server and client.

export function formatDate(dateStr) {
	return new Date(dateStr).toLocaleDateString('en-US', {
		month: 'short', day: 'numeric', year: 'numeric',
	});
}

export function formatCost(cost) {
	const num = parseFloat(cost);
	return num === 0 ? 'Free' : `$${num.toFixed(2)}`;
}
