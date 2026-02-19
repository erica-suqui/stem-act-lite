'use client';

import { usePathname } from 'next/navigation';

const links = [
	{ href: '/',         label: 'Dashboard' },
	{ href: '/partners', label: 'Partners' },
	{ href: '/users',    label: 'Users' },
	{ href: 'https://stemact.org', label: 'Public Site', external: true },
];

export default function NavLinks() {
	const pathname = usePathname();

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
