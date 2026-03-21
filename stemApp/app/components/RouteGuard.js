'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredItem,clearStoredAuth } from '@/lib/storage';

const PUBLIC_ROUTES = new Set(['/', '/login', '/register', '/submit','/verify-email']);

function isPartnerRoute(pathname, orgId) {
	return pathname === `/partners/${orgId}` || pathname === '/partner';
}

export default function RouteGuard({ children }) {
	const pathname = usePathname();
	const router = useRouter();
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		setIsReady(false);

		const role = getStoredItem('role');
		const orgId = getStoredItem('orgId');
		const isPublicRoute = PUBLIC_ROUTES.has(pathname);

		if (!role && !isPublicRoute) {
			router.replace('/');
			return;
		}

		if (role === 'partner') {
			if (!orgId) {
				clearStoredAuth();
				router.replace('/');
				return;
			}

			if (!isPublicRoute && !isPartnerRoute(pathname, orgId)) {
				router.replace(`/partners/${orgId}`);
				return;
			}
		}

		if ((role === 'admin' || role === 'super_admin') && pathname === '/login') {
			router.replace('/superAdminDashboard');
			return;
		}

		setIsReady(true);
	}, [pathname, router]);

	if (!isReady) {
		return null;
	}

	return children;
}
