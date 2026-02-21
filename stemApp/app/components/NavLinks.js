'use client';

import { usePathname } from 'next/navigation';

const links = [
	{ href: '/superAdminDashboard',         label: 'Dashboard' },
	{ href: '/partners', label: 'Partners' },
	{ href: '/users',    label: 'Users' },
	{ href: 'https://stemact.org', label: 'Public Site', external: true },
	{ href: '/',     label: 'Logout'},
];

export default function NavLinks() {
	const pathname = usePathname();
	const handleLogout = () => {
		localStorage.clear();
		window.location.href = '/';
	};

	if (pathname == '/' || pathname === '/register') 
		return null;

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
		</div>
	);
}
