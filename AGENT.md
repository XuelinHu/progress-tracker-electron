# AGENT.md

## Project

- Project: `progress-tracker-electron`
- Stack: Electron, React, Vite, Capacitor, Node preview server, PostgreSQL
- PM2 service: `progress-tracker-electron`

## Runtime

- Web/PM2 port: `4027`.
- Local URL: `http://127.0.0.1:4027/`.
- FRP URL: `http://47.120.48.245:14027/`.
- Dev: `npm run dev`.
- Electron dev: `npm start`.
- Build/check: `npm run check` or `npm run build`.
- Production preview: `npm run preview` using `scripts/preview-server.cjs`.

## Database

- Type: PostgreSQL.
- Local development database name: `progress_tracker_electron_dev`.
- Default host/port: `127.0.0.1:5432`.
- Env vars: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `APP_STATE_ID`.
- Core table: `app_state` with `id`, `owner_sub`, `data JSONB`, `revision`, `created_at`, `updated_at`.
- State rows are scoped by the immutable OIDC subject; legacy `id=main` rows with `owner_sub IS NULL` remain unclaimed.
- Run `database/provision.psql` with a cluster administrator, then use a dedicated migration identity and `npm run db:migrate` against a `_dev`/`_test` database. The app role has CRUD access only and the server does not run DDL.
- WebDAV vars: `DAV_URL`, `DAV_USERNAME`, `DAV_PASSWORD`, `DAV_PROJECT`.
- Keep real database/WebDAV credentials only in local `.env`.

## PM2

```bash
npm run build
pm2 restart progress-tracker-electron || pm2 start npm --name progress-tracker-electron -- run preview
pm2 save
```

## Codex Notes

- Before PM2 or FRP work, use the `frp-network` skill.
- Do not push to GitHub unless the user explicitly asks.

## GitHub Commit Language

- Use English for all GitHub commit messages and pull/push related commit notes.

## Port allocation

Web: 4027. API/services: 8035. See `PORTS.md`; keep dev/preview ports fixed and fail on conflicts.
