const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
	host: process.env.DB_HOST,
	port: process.env.DB_PORT,
	database: process.env.DB_NAME,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
});

const schema = `
CREATE TABLE IF NOT EXISTS organizations (
	org_id SERIAL PRIMARY KEY,
	org_name VARCHAR(100) NOT NULL,
	contact_email VARCHAR(255) NOT NULL,
	contact_phone VARCHAR(15),
	status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'disabled'))
	pin VARCHAR(50) UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
	user_id SERIAL PRIMARY KEY,
	email VARCHAR(255) NOT NULL UNIQUE,
	password_hash VARCHAR(255) NOT NULL,
	role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin', 'partner','viewer')),
	org_id INT REFERENCES organizations(org_id)
);

CREATE TABLE IF NOT EXISTS events (
	event_id SERIAL PRIMARY KEY,
	org_id INT REFERENCES organizations(org_id),
	title VARCHAR(150) NOT NULL,
	description TEXT,
	start_datetime TIMESTAMP NOT NULL,
	end_datetime TIMESTAMP,
	address VARCHAR(200),
	city VARCHAR(50),
	county VARCHAR(50),
	audience VARCHAR(100),
	cost DECIMAL(6,2) DEFAULT 0,
	event_link VARCHAR(500),
	contact_email VARCHAR(255),
	status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
	admin_comment TEXT,
	submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function init() {
	try {
		await pool.query(schema);
		console.log('Database tables created successfully.');
	} catch (err) {
		console.error('Error creating tables:', err.message);
	} finally {
		await pool.end();
	}
}

init();
