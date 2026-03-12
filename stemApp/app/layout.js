import './globals.css';
import AdminNav from './components/AdminNav';

export const metadata = {
	title: 'STEM-ACT Admin Dashboard',
	description: 'Admin portal for managing STEM event submissions',
};

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body>
				<AdminNav>{children}</AdminNav>
			</body>
		</html>
	);
}
