import knex, { Knex } from 'knex';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required in production mode!');
}

const isPostgres = !!(process.env.DATABASE_URL && (
  process.env.DATABASE_URL.startsWith('postgres://') ||
  process.env.DATABASE_URL.startsWith('postgresql://')
));

const connectionConfig = isPostgres
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : { filename: path.join(__dirname, '../../../db.sqlite') };

const config: Knex.Config = {
  client: isPostgres ? 'pg' : 'sqlite3',
  connection: connectionConfig,
  useNullAsDefault: !isPostgres,
  pool: isPostgres ? { min: 1, max: 5 } : undefined
};

export const db = knex(config);

// ─── Idempotent schema helpers ──────────────────────────────────────────────
// For PostgreSQL we use CREATE TABLE IF NOT EXISTS directly — this is the ONLY
// truly atomic, race-safe way to create a table.  Knex's hasTable() +
// createTable() is NOT atomic: through a transaction pooler (pgBouncer) the
// information_schema query can return stale results, causing a duplicate CREATE
// that collides with the already-registered pg_type entry.
//
// For SQLite we fall back to Knex's hasTable() because SQLite has no IF NOT
// EXISTS conflict issue and the raw SQL dialect differs.

async function createTablePg(name: string, ddl: string): Promise<void> {
  await db.raw(ddl);
  console.log(`Table ready: ${name}`);
}

async function createTableSqlite(
  name: string,
  builder: (t: Knex.CreateTableBuilder) => void
): Promise<void> {
  if (!(await db.schema.hasTable(name))) {
    await db.schema.createTable(name, builder);
    console.log(`Created table: ${name}`);
  } else {
    console.log(`Table exists: ${name}`);
  }
}

// ─── Main init ───────────────────────────────────────────────────────────────
// A simple in-process lock so concurrent test restarts never race.
let _initPromise: Promise<void> | null = null;

export function initializeDatabase(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = _doInit().catch(err => {
    _initPromise = null; // allow retry on hard failure
    throw err;
  });
  return _initPromise;
}

async function _doInit(): Promise<void> {
  console.log(`Initializing database... Mode: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);

  // Verify connection
  if (isPostgres) {
    try {
      const result = await db.raw('SELECT current_database(), current_user');
      console.log('Database connected successfully.');
      const row = result.rows[0];
      console.log(`Connected to database: "${row.current_database}" as user: "${row.current_user}"`);
    } catch (connErr: any) {
      console.error('Database connection verification failed:', connErr.message);
      throw connErr;
    }
  } else {
    console.log('Database connected successfully (SQLite local mode).');
  }

  // ── Schema creation ────────────────────────────────────────────────────────
  if (isPostgres) {
    // PostgreSQL: use CREATE TABLE IF NOT EXISTS for idempotency
    await createTablePg('users', `
      CREATE TABLE IF NOT EXISTS "users" (
        "id"            VARCHAR(255) NOT NULL PRIMARY KEY,
        "email"         VARCHAR(255) NOT NULL UNIQUE,
        "password_hash" VARCHAR(255) NOT NULL,
        "full_name"     VARCHAR(255) NOT NULL,
        "role"          VARCHAR(255) NOT NULL,
        "is_active"     BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await createTablePg('customers', `
      CREATE TABLE IF NOT EXISTS "customers" (
        "id"            VARCHAR(255) NOT NULL PRIMARY KEY,
        "name"          VARCHAR(255) NOT NULL,
        "phone"         VARCHAR(255),
        "email"         VARCHAR(255),
        "business_name" VARCHAR(255),
        "gst_number"    VARCHAR(255),
        "customer_type" VARCHAR(255) NOT NULL,
        "address"       VARCHAR(255),
        "status"        VARCHAR(255) NOT NULL DEFAULT 'Active',
        "follow_up_date" VARCHAR(255),
        "created_by"    VARCHAR(255),
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await createTablePg('customer_notes', `
      CREATE TABLE IF NOT EXISTS "customer_notes" (
        "id"              VARCHAR(255) NOT NULL PRIMARY KEY,
        "customer_id"     VARCHAR(255) NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
        "content"         TEXT NOT NULL,
        "created_by"      VARCHAR(255) NOT NULL,
        "created_by_name" VARCHAR(255) NOT NULL,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await createTablePg('products', `
      CREATE TABLE IF NOT EXISTS "products" (
        "id"            VARCHAR(255) NOT NULL PRIMARY KEY,
        "name"          VARCHAR(255) NOT NULL,
        "sku"           VARCHAR(255) NOT NULL UNIQUE,
        "category"      VARCHAR(255),
        "unit_price"    NUMERIC(10,2) NOT NULL,
        "current_stock" INTEGER NOT NULL DEFAULT 0,
        "minimum_stock" INTEGER NOT NULL DEFAULT 10,
        "location"      VARCHAR(255),
        "created_by"    VARCHAR(255),
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await createTablePg('challans', `
      CREATE TABLE IF NOT EXISTS "challans" (
        "id"             VARCHAR(255) NOT NULL PRIMARY KEY,
        "challan_number" VARCHAR(255) NOT NULL UNIQUE,
        "customer_id"    VARCHAR(255) NOT NULL REFERENCES "customers"("id"),
        "status"         VARCHAR(255) NOT NULL DEFAULT 'Draft',
        "total_quantity" INTEGER NOT NULL DEFAULT 0,
        "total_amount"   NUMERIC(10,2) NOT NULL DEFAULT 0,
        "notes"          TEXT,
        "created_by"     VARCHAR(255) NOT NULL,
        "confirmed_by"   VARCHAR(255),
        "confirmed_at"   TIMESTAMPTZ,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await createTablePg('challan_items', `
      CREATE TABLE IF NOT EXISTS "challan_items" (
        "id"                   VARCHAR(255) NOT NULL PRIMARY KEY,
        "challan_id"           VARCHAR(255) NOT NULL REFERENCES "challans"("id") ON DELETE CASCADE,
        "product_id"           VARCHAR(255) NOT NULL,
        "product_name_snapshot" VARCHAR(255) NOT NULL,
        "sku_snapshot"         VARCHAR(255) NOT NULL,
        "unit_price_snapshot"  NUMERIC(10,2) NOT NULL,
        "quantity"             INTEGER NOT NULL,
        "subtotal"             NUMERIC(10,2) NOT NULL
      )
    `);

    await createTablePg('stock_movements', `
      CREATE TABLE IF NOT EXISTS "stock_movements" (
        "id"            VARCHAR(255) NOT NULL PRIMARY KEY,
        "product_id"    VARCHAR(255) NOT NULL REFERENCES "products"("id"),
        "movement_type" VARCHAR(255) NOT NULL,
        "quantity"      INTEGER NOT NULL,
        "reason"        VARCHAR(255) NOT NULL,
        "created_by"    VARCHAR(255) NOT NULL,
        "reference"     VARCHAR(255),
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await createTablePg('activity_logs', `
      CREATE TABLE IF NOT EXISTS "activity_logs" (
        "id"          VARCHAR(255) NOT NULL PRIMARY KEY,
        "action"      VARCHAR(255) NOT NULL,
        "description" TEXT NOT NULL,
        "created_by"  VARCHAR(255) NOT NULL,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

  } else {
    // SQLite: use Knex schema builder (SQLite supports IF NOT EXISTS natively too,
    // but Knex's hasTable() is reliable here without a pooler in the way)
    await createTableSqlite('users', (table) => {
      table.string('id').primary();
      table.string('email').unique().notNullable();
      table.string('password_hash').notNullable();
      table.string('full_name').notNullable();
      table.string('role').notNullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    });

    await createTableSqlite('customers', (table) => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('phone').nullable();
      table.string('email').nullable();
      table.string('business_name').nullable();
      table.string('gst_number').nullable();
      table.string('customer_type').notNullable();
      table.string('address').nullable();
      table.string('status').notNullable().defaultTo('Active');
      table.string('follow_up_date').nullable();
      table.string('created_by').nullable();
      table.timestamps(true, true);
    });

    await createTableSqlite('customer_notes', (table) => {
      table.string('id').primary();
      table.string('customer_id').notNullable().references('id').inTable('customers').onDelete('CASCADE');
      table.text('content').notNullable();
      table.string('created_by').notNullable();
      table.string('created_by_name').notNullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });

    await createTableSqlite('products', (table) => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('sku').unique().notNullable();
      table.string('category').nullable();
      table.decimal('unit_price', 10, 2).notNullable();
      table.integer('current_stock').notNullable().defaultTo(0);
      table.integer('minimum_stock').notNullable().defaultTo(10);
      table.string('location').nullable();
      table.string('created_by').nullable();
      table.timestamps(true, true);
    });

    await createTableSqlite('challans', (table) => {
      table.string('id').primary();
      table.string('challan_number').unique().notNullable();
      table.string('customer_id').notNullable().references('id').inTable('customers');
      table.string('status').notNullable().defaultTo('Draft');
      table.integer('total_quantity').notNullable().defaultTo(0);
      table.decimal('total_amount', 10, 2).notNullable().defaultTo(0);
      table.text('notes').nullable();
      table.string('created_by').notNullable();
      table.string('confirmed_by').nullable();
      table.timestamp('confirmed_at').nullable();
      table.timestamps(true, true);
    });

    await createTableSqlite('challan_items', (table) => {
      table.string('id').primary();
      table.string('challan_id').notNullable().references('id').inTable('challans').onDelete('CASCADE');
      table.string('product_id').notNullable();
      table.string('product_name_snapshot').notNullable();
      table.string('sku_snapshot').notNullable();
      table.decimal('unit_price_snapshot', 10, 2).notNullable();
      table.integer('quantity').notNullable();
      table.decimal('subtotal', 10, 2).notNullable();
    });

    await createTableSqlite('stock_movements', (table) => {
      table.string('id').primary();
      table.string('product_id').notNullable().references('id').inTable('products');
      table.string('movement_type').notNullable();
      table.integer('quantity').notNullable();
      table.string('reason').notNullable();
      table.string('created_by').notNullable();
      table.string('reference').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });

    await createTableSqlite('activity_logs', (table) => {
      table.string('id').primary();
      table.string('action').notNullable();
      table.text('description').notNullable();
      table.string('created_by').notNullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  // ── Seed default data only if users table is empty ─────────────────────────
  const userCount = await db('users').count({ count: '*' }).first();
  const countVal = userCount ? parseInt(userCount.count as string, 10) : 0;
  if (countVal === 0) {
    console.log('Seeding default users and demo data...');
    const bcrypt = require('bcryptjs');
    const [hashAdmin, hashSales, hashWarehouse, hashAccounts] = await Promise.all([
      bcrypt.hash('Admin123!', 10),
      bcrypt.hash('Sales123!', 10),
      bcrypt.hash('Warehouse123!', 10),
      bcrypt.hash('Accounts123!', 10),
    ]);

    await db('users').insert([
      { id: 'u_admin',     email: 'admin@fundsroom.com',     password_hash: hashAdmin,     full_name: 'Bhavithagna Admin',  role: 'ADMIN',     is_active: true },
      { id: 'u_sales',     email: 'sales@fundsroom.com',     password_hash: hashSales,     full_name: 'Sales Agent',        role: 'SALES',     is_active: true },
      { id: 'u_warehouse', email: 'warehouse@fundsroom.com', password_hash: hashWarehouse, full_name: 'Warehouse Keeper',   role: 'WAREHOUSE', is_active: true },
      { id: 'u_accounts',  email: 'accounts@fundsroom.com',  password_hash: hashAccounts,  full_name: 'Accounts Manager',   role: 'ACCOUNTS',  is_active: true },
    ]);

    await db('products').insert([
      { id: 'p_bearing_x', name: 'Industrial Bearing X', sku: 'IB-X100', category: 'Bearings', unit_price: 150.00, current_stock: 18,  minimum_stock: 25, location: 'Shelf A3', created_by: 'u_admin' },
      { id: 'p_shaft_y',   name: 'Precision Shaft Y',   sku: 'PS-Y200', category: 'Shafts',   unit_price: 320.00, current_stock: 50,  minimum_stock: 15, location: 'Shelf B1', created_by: 'u_admin' },
      { id: 'p_gear_z',    name: 'Heavy Gear Z',         sku: 'HG-Z300', category: 'Gears',    unit_price: 450.00, current_stock: 8,   minimum_stock: 10, location: 'Shelf C4', created_by: 'u_admin' },
      { id: 'p_seal_w',    name: 'Rubber Seal W',        sku: 'RS-W400', category: 'Seals',    unit_price: 25.00,  current_stock: 120, minimum_stock: 50, location: 'Shelf A1', created_by: 'u_admin' },
    ]);

    await db('customers').insert([
      { id: 'c_abc', name: 'ABC Distributors', phone: '9876543210', email: 'contact@abcdist.com', business_name: 'ABC Distributors Pvt Ltd', gst_number: '27AAAAA1111A1Z1', customer_type: 'Wholesale', address: 'Mumbai, MH', status: 'Active', follow_up_date: new Date().toISOString(), created_by: 'u_admin' },
      { id: 'c_xyz', name: 'XYZ Retailers',    phone: '9876543211', email: 'info@xyzretail.com',  business_name: 'XYZ Retail',              gst_number: '27BBBBB2222B2Z2', customer_type: 'Retail',    address: 'Pune, MH',   status: 'Lead',   follow_up_date: new Date(Date.now() + 86400000 * 2).toISOString(), created_by: 'u_admin' },
    ]);

    await db('customer_notes').insert({
      id: 'cn_1',
      customer_id: 'c_abc',
      content: 'Follow-up regarding upcoming parts requirement. Scheduled a call.',
      created_by: 'u_sales',
      created_by_name: 'Sales Agent',
    });

    console.log('Seeding finished.');
  } else {
    console.log(`Skipping seed: ${countVal} user(s) already exist.`);
  }

  // ── Supabase Realtime + RLS (PostgreSQL only) ──────────────────────────────
  if (isPostgres) {
    console.log('Configuring Supabase RLS and Realtime publication...');

    const allTables = ['users', 'customers', 'customer_notes', 'products', 'challans', 'challan_items', 'stock_movements', 'activity_logs'];
    for (const table of allTables) {
      try {
        await db.raw(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      } catch {
        // Already enabled — not an error
      }
    }

    const realtimeTables = ['customers', 'customer_notes', 'products', 'stock_movements', 'challans', 'activity_logs'];
    for (const table of realtimeTables) {
      try {
        await db.raw(`ALTER TABLE "${table}" REPLICA IDENTITY FULL`);
        await db.raw(`
          DO $$
          BEGIN
            IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
              IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime' AND tablename = '${table}'
              ) THEN
                ALTER PUBLICATION supabase_realtime ADD TABLE "${table}";
              END IF;
            END IF;
          END $$;
        `);
        await db.raw(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_policies
              WHERE tablename = '${table}' AND policyname = 'Allow select for anon and authenticated'
            ) THEN
              CREATE POLICY "Allow select for anon and authenticated" ON "${table}"
              FOR SELECT TO anon, authenticated USING (true);
            END IF;
          END $$;
        `);
      } catch (e: any) {
        console.warn(`Realtime/RLS config warning for ${table}:`, e.message);
      }
    }
    console.log('Supabase RLS and Realtime configured.');
  }

  // ── Final table verification ───────────────────────────────────────────────
  const requiredTables = ['users', 'customers', 'customer_notes', 'products', 'challans', 'challan_items', 'stock_movements', 'activity_logs'];

  if (isPostgres) {
    // Verify directly via pg_tables — bypasses pooler stale cache
    const result = await db.raw(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY(?::text[])`,
      [requiredTables]
    );
    const found = result.rows.map((r: any) => r.tablename);
    const missing = requiredTables.filter(t => !found.includes(t));
    if (missing.length > 0) {
      throw new Error(`Required database tables missing: ${missing.join(', ')}`);
    }
  } else {
    for (const table of requiredTables) {
      const exists = await db.schema.hasTable(table);
      if (!exists) throw new Error(`Required table "${table}" was not created correctly.`);
    }
  }

  console.log('All required database tables verified.');
  console.log('Database initialized successfully.');
}

