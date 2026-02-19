import './globals.css';
import NavLinks from './components/NavLinks';

export const metadata = {
	title: 'STEM-ACT Admin Dashboard',
	description: 'Admin portal for managing STEM event submissions',
};

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body>
				<nav className="navbar" aria-label="Main navigation">
					<div className="nav-brand">
						{/* Not an h1 — page h1 lives inside each page's <main> (WCAG 1.3.1) */}
						<span className="nav-brand-name">STEM-ACT</span>
						<span className="nav-subtitle">Admin Dashboard</span>
					</div>
					<NavLinks />
				</nav>
				{children}
			</body>
		</html>
	);
}
