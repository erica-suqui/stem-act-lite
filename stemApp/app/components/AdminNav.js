'use client';

import { usePathname } from 'next/navigation';
import NavLinks from './NavLinks';
import RouteGuard from './RouteGuard';

const NO_NAV_ROUTES = new Set(['/submit']);

export default function AdminNav({ children }) {
	const pathname = usePathname();

	if (NO_NAV_ROUTES.has(pathname)) {
		return <>{children}</>;
	}

	return (
		<>
			<nav className="navbar" aria-label="Main navigation">
				<div className="nav-brand">
					<span className="nav-brand-name">STEM-ACT</span>
				</div>
				<NavLinks />
			</nav>
			<RouteGuard>{children}</RouteGuard>
		</>
	);
}
