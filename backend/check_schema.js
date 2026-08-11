require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const client = await pool.connect();
  try {
    // List all tables in public schema
    const tables = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    );
    console.log('=== TABLES IN SUPABASE ===');
    if (tables.rows.length === 0) {
      console.log('  (no tables found)');
    } else {
      tables.rows.forEach(r => console.log(' -', r.tablename));
    }

    // Check for orphaned composite types matching our table names
    const types = await client.query(
      `SELECT typname FROM pg_type 
       WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
       AND typname IN ('users','customers','customer_notes','products','challans','challan_items','stock_movements','activity_logs')
       ORDER BY typname`
    );
    console.log('\n=== COMPOSITE TYPES IN PG_TYPE ===');
    if (types.rows.length === 0) {
      console.log('  (none)');
    } else {
      types.rows.forEach(r => console.log(' -', r.typname));
    }
  } finally {
    client.release();
    await pool.end();
  }
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
