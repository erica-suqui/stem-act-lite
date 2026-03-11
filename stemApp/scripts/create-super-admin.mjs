import bcrypt from 'bcrypt';
import pg from 'pg';

const [, , emailArg, passwordArg, userNameArg] = process.argv;

if (!process.env.DATABASE_URL) {
	console.error('DATABASE_URL is not set.');
	process.exit(1);
}

if (!emailArg || !passwordArg) {
	console.error('Usage: node --env-file=.env.local scripts/create-super-admin.mjs <email> <password> [user_name]');
	process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const password = passwordArg.trim();
const userName = (userNameArg?.trim() || email.split('@')[0] || 'superadmin');

if (password.length < 8) {
	console.error('Password must be at least 8 characters long.');
	process.exit(1);
}

const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL,
});

try {
	const existingSuperAdminResult = await pool.query(
		`
		SELECT user_id, email
		FROM users
		WHERE role = 'super_admin' AND lower(email) <> $1
		LIMIT 1
		`,
		[email],
	);

	if (existingSuperAdminResult.rows[0]) {
		console.error(`Another super admin already exists: ${existingSuperAdminResult.rows[0].email}`);
		process.exit(1);
	}

	const passwordHash = await bcrypt.hash(password, 10);
	const existingUserResult = await pool.query(
		`
		SELECT user_id
		FROM users
		WHERE lower(email) = $1
		LIMIT 1
		`,
		[email],
	);

	if (existingUserResult.rows[0]) {
		const updatedUserResult = await pool.query(
			`
			UPDATE users
			SET user_name = $2,
			    password_hash = $3,
			    role = 'super_admin',
			    org_id = NULL
			WHERE user_id = $1
			RETURNING user_id, email, role
			`,
			[existingUserResult.rows[0].user_id, userName, passwordHash],
		);

		console.log(`Updated user ${updatedUserResult.rows[0].email} to role ${updatedUserResult.rows[0].role}.`);
	} else {
		const insertedUserResult = await pool.query(
			`
			INSERT INTO users (org_id, user_name, password_hash, email, role)
			VALUES (NULL, $1, $2, $3, 'super_admin')
			RETURNING user_id, email, role
			`,
			[userName, passwordHash, email],
		);

		console.log(`Created user ${insertedUserResult.rows[0].email} with role ${insertedUserResult.rows[0].role}.`);
	}
} finally {
	await pool.end();
}
