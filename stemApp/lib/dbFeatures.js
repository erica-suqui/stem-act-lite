import pool from '@/lib/db';

export async function hasEventTagTables() {
	const result = await pool.query(`
		SELECT
			to_regclass('public.event_tags') IS NOT NULL AS has_event_tags,
			to_regclass('public.tags') IS NOT NULL AS has_tags
	`);

	const row = result.rows[0] ?? {};
	return Boolean(row.has_event_tags) && Boolean(row.has_tags);
}

export async function hasSplitContactNameColumns() {
	const result = await pool.query(`
		SELECT
			EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'organizations'
				  AND column_name = 'contact_first_name'
			) AS has_contact_first_name,
			EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
				  AND table_name = 'organizations'
				  AND column_name = 'contact_last_name'
			) AS has_contact_last_name
	`);

	const row = result.rows[0] ?? {};
	return Boolean(row.has_contact_first_name) && Boolean(row.has_contact_last_name);
}
