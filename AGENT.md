# AGENT.md

## Project

- Project: `progress-tracker-electron`
- Stack: Electron, React, Vite, Capacitor, Node preview server, PostgreSQL
- PM2 service: `progress-tracker-electron`

## Runtime

- Web/PM2 port: `4003`.
- Local URL: `http://127.0.0.1:4003/`.
- FRP URL: `http://47.120.48.245:14003/`.
- Dev: `npm run dev`.
- Electron dev: `npm start`.
- Build/check: `npm run check` or `npm run build`.
- Production preview: `npm run preview` using `scripts/preview-server.cjs`.

## Database

- Type: PostgreSQL.
- Database name: `progress_tracker_electron`.
- Default host/port: `127.0.0.1:5432`.
- Env vars: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `APP_STATE_ID`.
- Core table: `app_state` with `id`, `data JSONB`, `created_at`, `updated_at`.
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
