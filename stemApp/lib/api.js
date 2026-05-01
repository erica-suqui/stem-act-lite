const API_BASE_URL = 'https://stemact-events-826054413130.us-east1.run.app';

export function apiUrl(path) {
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return `${API_BASE_URL}${normalizedPath}`;
}
