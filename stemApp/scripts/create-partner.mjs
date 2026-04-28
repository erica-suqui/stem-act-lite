import bcrypt from 'bcrypt';
import pg from 'pg';

const [, , emailArg, passwordArg, orgNameArg, firstNameArg, lastNameArg, phoneArg] = process.argv;

if (!process.env.DATABASE_URL) {
	console.error('DATABASE_URL is not set.');
	process.exit(1);
}

if (!emailArg || !passwordArg || !orgNameArg) {
	console.error(
		'Usage: node --env-file=.env.local scripts/create-partner.mjs <email> <password> <org_name> [first_name] [last_name] [phone]'
	);
	process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const password = passwordArg.trim();
const orgName = orgNameArg.trim();
const firstName = firstNameArg?.trim() || '';
const lastName = lastNameArg?.trim() || '';
const phone = phoneArg?.trim() || '';
const userName = email.split('@')[0] || email;

if (password.length < 8) {
	console.error('Password must be at least 8 characters long.');
	process.exit(1);
}

const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL,
});

try {
	const passwordHash = await bcrypt.hash(password, 10);
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		const existingOrgResult = await client.query(
			`
			SELECT org_id, org_name, contact_email, contact_phone
			FROM organizations
			WHERE lower(org_name) = $1
			LIMIT 1
			`,
			[orgName.toLowerCase()],
		);

		let orgId;
		if (existingOrgResult.rows[0]) {
			orgId = existingOrgResult.rows[0].org_id;
			await client.query(
				`
				UPDATE organizations
				SET status = 'active',
				    contact_first_name = CASE WHEN contact_first_name = '' OR contact_first_name IS NULL THEN $2 ELSE contact_first_name END,
				    contact_last_name = CASE WHEN contact_last_name = '' OR contact_last_name IS NULL THEN $3 ELSE contact_last_name END,
				    contact_email = CASE WHEN contact_email = '' THEN $4 ELSE contact_email END,
				    contact_phone = CASE WHEN contact_phone = '' THEN $5 ELSE contact_phone END
				WHERE org_id = $1
				`,
				[orgId, firstName, lastName, email, phone],
			);
		} else {
			const insertedOrgResult = await client.query(
				`
				INSERT INTO organizations (
					org_name,
					contact_first_name,
					contact_last_name,
					contact_email,
					contact_phone,
					status
				)
				VALUES ($1, $2, $3, $4, $5, 'active')
				RETURNING org_id
				`,
				[orgName, firstName, lastName, email, phone],
			);
			orgId = insertedOrgResult.rows[0].org_id;
		}

		const existingUserResult = await client.query(
			`
			SELECT user_id
			FROM users
			WHERE lower(email) = $1
			LIMIT 1
			`,
			[email],
		);

		if (existingUserResult.rows[0]) {
			const updatedUserResult = await client.query(
				`
				UPDATE users
				SET user_name = $2,
				    password_hash = $3,
				    role = 'partner',
				    org_id = $4,
				    email_verified = TRUE
				WHERE user_id = $1
				RETURNING user_id, email, role, org_id, email_verified
				`,
				[existingUserResult.rows[0].user_id, userName, passwordHash, orgId],
			);

			await client.query('COMMIT');
			console.log(
				`Updated user ${updatedUserResult.rows[0].email} to role ${updatedUserResult.rows[0].role} for org ${orgId}.`
			);
		} else {
			const insertedUserResult = await client.query(
				`
				INSERT INTO users (org_id, user_name, password_hash, email, role, email_verified)
				VALUES ($1, $2, $3, $4, 'partner', TRUE)
				RETURNING user_id, email, role, org_id, email_verified
				`,
				[orgId, userName, passwordHash, email],
			);

			await client.query('COMMIT');
			console.log(
				`Created partner ${insertedUserResult.rows[0].email} for org ${orgId} with verified email.`
			);
		}
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
} finally {
	await pool.end();
}
