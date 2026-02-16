import './globals.css';

export const metadata = {
	title: 'STEM-ACT Admin Dashboard',
	description: 'Admin portal for managing STEM event submissions',
};

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body>
				<nav className="navbar">
					<div className="nav-brand">
						<h1>STEM-ACT</h1>
						<span className="nav-subtitle">Admin Dashboard</span>
					</div>
					<div className="nav-links">
						<a href="/">Dashboard</a>
						<a href="http://localhost:3001" target="_blank" rel="noopener">
							Public Site
						</a>
					</div>
				</nav>
				{children}
			</body>
		</html>
	);
}
