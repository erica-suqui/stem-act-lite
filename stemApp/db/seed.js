const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
	host: process.env.DB_HOST,
	port: process.env.DB_PORT,
	database: process.env.DB_NAME,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
});

async function seed() {
	try {
		// Clear existing data
		await pool.query('DELETE FROM events');
		await pool.query('DELETE FROM users');
		await pool.query('DELETE FROM organizations');

		// Reset sequences
		await pool.query("ALTER SEQUENCE organizations_org_id_seq RESTART WITH 1");
		await pool.query("ALTER SEQUENCE users_user_id_seq RESTART WITH 1");
		await pool.query("ALTER SEQUENCE events_event_id_seq RESTART WITH 1");

		// Insert organizations
		await pool.query(`
			INSERT INTO organizations (org_name, contact_email, contact_phone, status) VALUES
			('Yale STEM Outreach', 'stem@yale.edu', '203-555-0101', 'active'),
			('CT Science Center', 'events@ctsci.org', '860-555-0202', 'active'),
			('Wilbur Elementary School', 'mfrank@wilbur.edu', '203-555-0303', 'active'),
			('New Haven Public Library', 'programs@nhpl.org', '203-555-0404', 'pending')
		`);

		// Insert admin user
		await pool.query(`
			INSERT INTO users (email, password_hash, role, org_id) VALUES
			('admin@stemact.org', '$2b$10$placeholder', 'super_admin', NULL),
			('cheryl@stemact.org', '$2b$10$placeholder', 'admin', NULL),
			('stem@yale.edu', '$2b$10$placeholder', 'partner', 1),
			('events@ctsci.org', '$2b$10$placeholder', 'partner', 2),
			('mfrank@wilbur.edu', '$2b$10$placeholder', 'partner', 3)
		`);

		// Insert sample events
		await pool.query(`
			INSERT INTO events (org_id, title, description, start_datetime, end_datetime, address, city, county, audience, cost, event_link, contact_email, status, admin_comment, submitted_at) VALUES
			(1, 'Robotics Workshop for Teens', 'Hands-on workshop teaching students to build and program robots using Arduino kits.', '2026-03-15 10:00:00', '2026-03-15 14:00:00', '15 Prospect St', 'New Haven', 'New Haven', 'Ages 13-18', 0, 'https://yale.edu/stem-robotics', 'stem@yale.edu', 'pending', NULL, '2026-02-10 09:00:00'),
			(1, 'Women in STEM Panel', 'Panel discussion featuring women in various STEM fields sharing their career journeys.', '2026-03-22 18:00:00', '2026-03-22 20:00:00', '150 York St', 'New Haven', 'New Haven', 'High School & College Students', 0, 'https://yale.edu/women-stem', 'stem@yale.edu', 'approved', NULL, '2026-02-05 11:30:00'),
			(2, 'Family Science Night', 'Interactive science experiments and demonstrations for the whole family.', '2026-04-05 17:00:00', '2026-04-05 20:00:00', '250 Columbus Blvd', 'Hartford', 'Hartford', 'Families', 12.00, 'https://ctsci.org/family-night', 'events@ctsci.org', 'pending', NULL, '2026-02-12 14:00:00'),
			(2, 'Coding Bootcamp for Kids', 'Introduction to coding using Scratch and Python for elementary school students.', '2026-04-12 09:00:00', '2026-04-12 12:00:00', '250 Columbus Blvd', 'Hartford', 'Hartford', 'Ages 8-12', 5.00, 'https://ctsci.org/kids-coding', 'events@ctsci.org', 'denied', 'Missing age-appropriate safety information. Please add supervision details.', '2026-02-08 10:00:00'),
			(3, 'STEM Career Fair', 'Local professionals showcase STEM career paths for elementary students.', '2026-03-28 09:00:00', '2026-03-28 13:00:00', '45 School St', 'Middletown', 'Middlesex', 'Elementary Students', 0, NULL, 'mfrank@wilbur.edu', 'pending', NULL, '2026-02-14 16:30:00'),
			(3, 'Math Olympics Prep Session', 'Preparation workshop for the upcoming regional Math Olympics competition.', '2026-03-10 15:00:00', '2026-03-10 17:00:00', '45 School St', 'Middletown', 'Middlesex', 'Grades 3-5', 0, NULL, 'mfrank@wilbur.edu', 'approved', NULL, '2026-01-25 08:00:00')
		`);

		console.log('Database seeded successfully with sample data.');
	} catch (err) {
		console.error('Error seeding database:', err.message);
	} finally {
		await pool.end();
	}
}

seed();
