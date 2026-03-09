import { Pool } from 'pg';

const globalForPg = globalThis;

const pool =
	globalForPg.__stemActPgPool ??
	new Pool({
		connectionString: process.env.DATABASE_URL,
	});

if (process.env.NODE_ENV !== 'production') {
	globalForPg.__stemActPgPool = pool;
}

export default pool;
