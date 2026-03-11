'use client';

import { useState, useCallback } from 'react';

export function useToast() {
	const [toasts, setToasts] = useState([]);

	const addToast = useCallback((message, type = 'success') => {
		const id = Date.now();
		setToasts(prev => [...prev, { id, message, type }]);
		if (type === 'success') {
			setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
		}
		// Error toasts persist until manually dismissed
	}, []);

	const dismissToast = useCallback((id) => {
		setToasts(prev => prev.filter(t => t.id !== id));
	}, []);

	return { toasts, addToast, dismissToast };
}
