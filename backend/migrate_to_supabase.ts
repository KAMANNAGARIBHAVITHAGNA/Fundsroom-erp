import knex from 'knex';
import path from 'path';
import dotenv from 'dotenv';
import { initializeDatabase } from './src/config/db';

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://'))) {
  console.error('\nError: DATABASE_URL is not set or is not a valid PostgreSQL connection string in backend/.env.');
  console.error('Please configure DATABASE_URL to your Supabase PostgreSQL database before running this migration.\n');
  process.exit(1);
}

const sqliteDb = knex({
  client: 'sqlite3',
  connection: {
    filename: path.join(__dirname, '../db.sqlite')
  },
  useNullAsDefault: true
});

const pgDb = knex({
  client: 'pg',
  connection: databaseUrl,
  pool: { min: 1, max: 5 }
});

async function migrateTable(tableName: string, primaryKey = 'id') {
  console.log(`Migrating table: ${tableName}...`);
  
  // Read from SQLite
  const sqliteRecords = await sqliteDb(tableName).select('*');
  console.log(`Found ${sqliteRecords.length} records in SQLite table "${tableName}"`);
  
  if (sqliteRecords.length === 0) {
    return;
  }

  let migratedCount = 0;
  let skippedCount = 0;

  for (const record of sqliteRecords) {
    // Check if record exists in PG
    const exists = await pgDb(tableName)
      .where(primaryKey, record[primaryKey])
      .first();

    if (!exists) {
      // In SQLite, boolean values are stored as 1/0 or true/false strings. Convert them properly for PG.
      const formattedRecord = { ...record };
      if ('is_active' in formattedRecord) {
        formattedRecord.is_active = !!formattedRecord.is_active;
      }
      
      await pgDb(tableName).insert(formattedRecord);
      migratedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`Table "${tableName}" migration completed. Migrated: ${migratedCount}, Skipped (already exist): ${skippedCount}`);
}

async function run() {
  console.log('Starting data migration to Supabase PostgreSQL...');
  
  try {
    // 1. Verify schema on PG by running schema initializer on Postgres
    console.log('Verifying table schemas on remote PostgreSQL database...');
    await initializeDatabase();
    
    // 2. Migrate tables in correct order of dependency
    await migrateTable('users');
    await migrateTable('products');
    await migrateTable('customers');
    await migrateTable('customer_notes');
    await migrateTable('challans');
    await migrateTable('challan_items');
    await migrateTable('stock_movements');
    await migrateTable('activity_logs');
    
    console.log('\nSUCCESS: All data migrated from SQLite to Supabase PostgreSQL successfully!');
  } catch (err: any) {
    console.error('\nERROR: Migration failed:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await sqliteDb.destroy();
    await pgDb.destroy();
  }
}

run();
