import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');
const database = 'progress_tracker_electron_dev';
const appRole = 'progress_tracker_electron_app';

if (existsSync(envPath)) throw new Error('.env.local already exists; refusing to overwrite local settings.');

const admin = new Client({ host: '127.0.0.1', port: 5432, user: 'postgres', database: 'postgres' });
const appPassword = randomBytes(48).toString('base64url');

await admin.connect();
try {
  const identity = await admin.query(`
    SELECT current_user, r.rolsuper
    FROM pg_roles r
    WHERE r.rolname = current_user
  `);
  if (identity.rows[0]?.current_user !== 'postgres' || identity.rows[0]?.rolsuper !== true) {
    throw new Error('Local PostgreSQL connection must be the postgres administrator role.');
  }

  const existing = await admin.query(
    `SELECT (SELECT count(*) FROM pg_database WHERE datname = $1) AS databases,
            (SELECT count(*) FROM pg_roles WHERE rolname = $2) AS roles,
            (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = $1) AS owner`,
    [database, appRole],
  );
  const databaseExists = Number(existing.rows[0].databases) === 1;
  const roleExists = Number(existing.rows[0].roles) === 1;
  if (databaseExists !== roleExists) {
    throw new Error('Only one target object exists; inspect it before provisioning.');
  }
  if (databaseExists) {
    if (existing.rows[0].owner !== appRole) {
      throw new Error('Existing target database has a different owner; refusing to alter it.');
    }
    const target = new Client({ host: '127.0.0.1', port: 5432, user: 'postgres', database });
    await target.connect();
    try {
      const state = await target.query(`
        SELECT to_regclass('public.app_state') IS NOT NULL AS has_state,
               to_regclass('public.schema_migrations') IS NOT NULL AS has_ledger,
               (SELECT count(*) FROM app_state) AS state_rows,
               (SELECT count(*) FROM schema_migrations) AS migration_rows,
               (SELECT count(*) FROM schema_migrations WHERE version = '001_user_scoped_state') AS expected_migration
      `);
      const row = state.rows[0];
      if (!row.has_state || !row.has_ledger || Number(row.state_rows) !== 0
        || Number(row.migration_rows) !== 1 || Number(row.expected_migration) !== 1) {
        throw new Error('Existing target is not the expected empty initialized database; refusing recovery.');
      }
    } finally {
      await target.end();
    }
    await admin.query(`ALTER ROLE ${appRole} PASSWORD '${appPassword}'`);
  } else {
    await admin.query(`CREATE ROLE ${appRole} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${appPassword}'`);
    await admin.query(`CREATE DATABASE ${database} OWNER ${appRole}`);
  }
} finally {
  await admin.end();
}

const dbEnv = {
  PGHOST: '127.0.0.1',
  PGPORT: '5432',
  PGDATABASE: database,
  PGUSER: appRole,
  PGPASSWORD: appPassword,
};
const migration = spawnSync(process.execPath, ['database/migrations/apply.mjs'], {
  cwd: root,
  env: { ...process.env, ...dbEnv },
  encoding: 'utf8',
});
if (migration.stdout) process.stdout.write(migration.stdout);
if (migration.status !== 0) {
  if (migration.stderr) process.stderr.write(migration.stderr);
  throw new Error('Local PostgreSQL migration failed; the newly created database was retained for inspection.');
}

const app = new Client({
  host: dbEnv.PGHOST,
  port: Number(dbEnv.PGPORT),
  database: dbEnv.PGDATABASE,
  user: dbEnv.PGUSER,
  password: dbEnv.PGPASSWORD,
});
await app.connect();
try {
  const result = await app.query(`
    SELECT current_database() AS database,
           current_user AS role,
           has_table_privilege(current_user, 'app_state', 'SELECT,INSERT,UPDATE,DELETE') AS can_use_state,
           EXISTS (SELECT 1 FROM schema_migrations WHERE version = '001_user_scoped_state') AS migration_applied
  `);
  if (!result.rows[0].can_use_state || !result.rows[0].migration_applied) {
    throw new Error('Application role or schema verification failed.');
  }
} finally {
  await app.end();
}

const envFile = [
  '# Local Progress Tracker development database. This file is ignored by Git.',
  ...Object.entries(dbEnv).map(([key, value]) => `${key}=${value}`),
  'APP_STATE_ID=main',
  'WEB_PORT=4027',
  'API_PORT=8035',
  'OIDC_ISSUER=https://192.168.1.9:8042/realms/front',
  'OIDC_CLIENT_ID=progress-tracker-electron-web',
  'OIDC_WEB_ORIGINS=https://192.168.1.9:4093,http://localhost:4027,http://127.0.0.1:4027,https://localhost',
  '',
].join('\n');
writeFileSync(envPath, envFile, { flag: 'wx', mode: 0o600 });
console.log(`Provisioned ${database} with its isolated application role and applied migrations.`);
