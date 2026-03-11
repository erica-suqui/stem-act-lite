'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function NavLinks() {
	const pathname = usePathname();
	const [isMounted, setIsMounted] = useState(false);
	const [role, setRole] = useState(null);

	useEffect(() => {
		setIsMounted(true);
		setRole(localStorage.getItem('role'));
	}, [pathname]);
	const handleLogout = () => {
		localStorage.clear();
		window.location.href = '/';
	};

	if (pathname === '/' || pathname === '/login' || pathname === '/register') {
		return null;
	}

	if (!isMounted) {
		return null;
	}

	if (role === 'partner') {
		return (
			<div className="nav-links">
				<a
					href="https://stemact.org"
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Public Site (opens in new tab)"
				>
					Public Site
				</a>
				<button type="button" onClick={handleLogout}>
					Logout
				</button>
			</div>
		);
	}

	const links = [
		{ href: '/superAdminDashboard', label: 'Dashboard' },
		{ href: '/partners', label: 'Partners' },
		{ href: '/users', label: 'Users' },
		{ href: 'https://stemact.org', label: 'Public Site', external: true },
	];

	return (
		<div className="nav-links">
			{links.map(link => {
				const isActive = !link.external && pathname === link.href;
				
				return (
					<a
						key={link.href}
						href={link.href}
						className={isActive ? 'nav-active' : undefined}
						aria-current={isActive ? 'page' : undefined}
						{...(link.external
							? { target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Public Site (opens in new tab)' }
							: {}
						)}
					>
						{link.label}

					</a>
					
				);
			})}
			<button type="button" onClick={handleLogout}>
				Logout
			</button>
		</div>
	);
}
