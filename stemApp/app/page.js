'use client';

import LogIn from './components/LogIn';

export default function HomePage() {
	return (
		<main className="login-container">
			<h2>Log In</h2>
			<LogIn />
			<h5>
				Not a User? Please <a href="/register"><span>Register</span></a> here first
			</h5>
		</main>
	);
}
