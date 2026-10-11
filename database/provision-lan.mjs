import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');
const database = 'progress_tracker_electron_dev';
const appRole = 'progress_tracker_electron_app';
const adminConfigPath = resolve(root, '.env');

if (existsSync(envPath)) throw new Error('.env.local already exists; refusing to overwrite LAN settings.');
if (!existsSync(adminConfigPath)) throw new Error('A private .env with the approved LAN administrator connection is required.');

function readEnv(filePath) {
  return Object.fromEntries(readFileSync(filePath, 'utf8').split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      if (index < 1) return ['', ''];
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return [line.slice(0, index).trim(), value];
    })
    .filter(([key]) => key));
}

const privateConfig = readEnv(adminConfigPath);
if (!privateConfig.PGPASSWORD) throw new Error('The private LAN .env must contain PGPASSWORD.');

const admin = new Client({
  host: '127.0.0.1',
  port: 5433,
  user: 'deipss',
  password: privateConfig.PGPASSWORD,
  database: 'postgres',
});
const appPassword = randomBytes(48).toString('base64url');

await admin.connect();
try {
  const identity = await admin.query(`
    SELECT current_user, current_setting('server_version_num')::integer AS version_num, r.rolsuper, r.rolcreatedb, r.rolcreaterole
    FROM pg_roles r WHERE r.rolname = current_user
  `);
  const adminIdentity = identity.rows[0];
  if (adminIdentity.current_user !== 'deipss' || adminIdentity.version_num < 180000 || adminIdentity.version_num >= 190000
    || !adminIdentity.rolsuper || !adminIdentity.rolcreatedb || !adminIdentity.rolcreaterole) {
    throw new Error('The LAN connection must be the authorized PostgreSQL 18 cluster administrator.');
  }

  const existing = await admin.query(
    'SELECT (SELECT count(*) FROM pg_database WHERE datname = $1) AS databases, (SELECT count(*) FROM pg_roles WHERE rolname = $2) AS roles',
    [database, appRole],
  );
  if (Number(existing.rows[0].databases) || Number(existing.rows[0].roles)) {
    throw new Error('The target LAN database or role already exists; inspect it before provisioning.');
  }

  await admin.query(`CREATE ROLE ${appRole} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${appPassword}'`);
  await admin.query(`CREATE DATABASE ${database} OWNER ${appRole}`);
} finally {
  await admin.end();
}

const dbEnv = {
  PGHOST: '127.0.0.1',
  PGPORT: '5433',
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
  throw new Error('LAN PostgreSQL migration failed; the new database was retained for inspection.');
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
    throw new Error('LAN application role or schema verification failed.');
  }
} finally {
  await app.end();
}

const envFile = [
  '# LAN Progress Tracker development database. This file is ignored by Git.',
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
console.log(`Provisioned ${database} on LAN PostgreSQL 18 with its isolated application role and migrations.`);
