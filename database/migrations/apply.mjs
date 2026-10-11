import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const directory = fileURLToPath(new URL('./', import.meta.url));
const files = (await readdir(directory)).filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file)).sort();
if (!files.length) throw new Error('No numbered SQL migrations found');

const database = process.env.PGDATABASE || '';
if (!database || !/(?:_dev|_test|_development)$/i.test(database)) {
  throw new Error('Refusing migration: PGDATABASE must end in _dev, _development, or _test');
}
if (!process.env.PGHOST || !process.env.PGUSER || !process.env.PGPASSWORD) {
  throw new Error('PGHOST, PGUSER, and PGPASSWORD must be explicitly provided');
}

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

await client.connect();
try {
  await client.query('SELECT pg_advisory_lock(hashtext($1))', ['progress-tracker-electron:migrations']);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  for (const file of files) {
    const sql = await readFile(join(directory, file), 'utf8');
    const version = basename(file, '.sql');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const existing = await client.query('SELECT checksum FROM schema_migrations WHERE version = $1', [version]);
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) throw new Error(`Migration checksum mismatch: ${version}`);
      console.log(`already applied: ${version}`);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [version, checksum]);
      await client.query('COMMIT');
      console.log(`applied: ${version}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['progress-tracker-electron:migrations']).catch(() => {});
  await client.end();
}
