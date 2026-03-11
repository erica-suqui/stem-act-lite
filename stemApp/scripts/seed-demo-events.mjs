import pg from 'pg';

if (!process.env.DATABASE_URL) {
	console.error('DATABASE_URL is not set.');
	process.exit(1);
}

const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL,
});

const eventTemplates = [
	{
		title: 'STEM Discovery Night',
		description: 'Hands-on stations for robotics, chemistry, and coding designed for families and middle school students.',
		start_datetime: '2026-03-24T22:00:00.000Z',
		end_datetime: '2026-03-25T00:00:00.000Z',
		address: '100 Science Way',
		city: 'New Haven',
		county: 'New Haven',
		audience: 'Families and Grades 5-8',
		cost: '0.00',
		hyperlink: 'https://stemact.org/demo-events/discovery-night',
		status: 'pending',
		admin_comment: null,
	},
	{
		title: 'Girls Who Code Workshop',
		description: 'Introductory coding workshop focused on web basics, debugging, and small group mentoring.',
		start_datetime: '2026-04-02T20:30:00.000Z',
		end_datetime: '2026-04-02T22:30:00.000Z',
		address: '200 Innovation Ave',
		city: 'Hartford',
		county: 'Hartford',
		audience: 'Grades 6-10',
		cost: '0.00',
		hyperlink: 'https://stemact.org/demo-events/girls-code',
		status: 'approved',
		admin_comment: null,
	},
	{
		title: 'Community Engineering Expo',
		description: 'Interactive engineering demos and design challenges for students interested in civil and mechanical systems.',
		start_datetime: '2026-04-16T21:00:00.000Z',
		end_datetime: '2026-04-16T23:30:00.000Z',
		address: '50 Main St',
		city: 'Middletown',
		county: 'Middlesex',
		audience: 'High school students',
		cost: '5.00',
		hyperlink: 'https://stemact.org/demo-events/engineering-expo',
		status: 'denied',
		admin_comment: 'Please add a clearer supervision plan and room capacity details before resubmitting.',
	},
];

try {
	const partnerResult = await pool.query(
		`
		SELECT
			u.user_id,
			u.user_name,
			u.email,
			o.org_id,
			o.org_name,
			o.contact_email,
			o.contact_phone
		FROM users u
		INNER JOIN organizations o ON o.org_id = u.org_id
		WHERE u.role = 'partner'
		ORDER BY o.org_name, u.user_id
		`,
	);

	if (partnerResult.rows.length === 0) {
		console.log('No partner users found. Nothing to seed.');
		process.exit(0);
	}

	let insertedCount = 0;

	for (const partner of partnerResult.rows) {
		for (const template of eventTemplates) {
			const title = `${partner.org_name} ${template.title}`;
			const existingEventResult = await pool.query(
				`
				SELECT event_id
				FROM events
				WHERE org_id = $1 AND title = $2
				LIMIT 1
				`,
				[partner.org_id, title],
			);

			if (existingEventResult.rows[0]) {
				continue;
			}

			await pool.query(
				`
				INSERT INTO events (
					org_id,
					submitted_by_user_id,
					submitter_name,
					submitter_email,
					submitter_phone,
					title,
					description,
					start_datetime,
					end_datetime,
					address,
					city,
					county,
					audience,
					cost,
					hyperlink,
					event_contact,
					admin_comment,
					status
				)
				VALUES (
					$1, $2, $3, $4, $5, $6, $7, $8, $9,
					$10, $11, $12, $13, $14, $15, $16, $17, $18
				)
				`,
				[
					partner.org_id,
					partner.user_id,
					partner.user_name,
					partner.email,
					partner.contact_phone,
					title,
					template.description,
					template.start_datetime,
					template.end_datetime,
					template.address,
					template.city,
					template.county,
					template.audience,
					template.cost,
					template.hyperlink,
					partner.contact_email || partner.email,
					template.admin_comment,
					template.status,
				],
			);

			insertedCount += 1;
		}
	}

	console.log(`Seeded ${insertedCount} demo event(s) across ${partnerResult.rows.length} partner user(s).`);
} finally {
	await pool.end();
}
