# AGENTS.md

## Project

- Project: `progress-tracker-electron`
- Stack: Electron, React, Vite, Capacitor
- Default branch: `master`
- Git remote: `origin`
- PM2 service: `progress-tracker-electron`

## Network And Startup

- Before starting, restarting, deploying, or troubleshooting this project, use the `frp-network` skill.
- Follow the skill's local-service-first rule and do not commit private credentials or connection strings.
- Local frontend port: `4003`
- Local URL: `http://127.0.0.1:4003/`
- FRP public frontend port: `14003`
- FRP mapping: public port `14003` to local port `4003`
- Start the production preview with PM2 using the existing service:

```bash
npm run build
pm2 restart progress-tracker-electron
pm2 save
```

- If the PM2 service does not exist, create it from the repository root:

```bash
pm2 start npm --name progress-tracker-electron -- run preview
pm2 save
```

## Required Update Workflow

After every code, configuration, documentation, or data-structure update:

1. Run the relevant verification. At minimum, run:

```bash
npm run check
```

2. For user-facing changes, rebuild and restart the existing PM2 service:

```bash
npm run build
pm2 restart progress-tracker-electron
pm2 save
```

3. Verify the deployed service:

```bash
curl -fsS http://127.0.0.1:4003/ > /dev/null
pm2 describe progress-tracker-electron
```

4. Only after verification passes, commit all task-related changes and push them to GitHub:

```bash
git add <task-related-files>
git commit -m "<clear commit message>"
git push origin master
```

5. Confirm the worktree is clean and `HEAD`, `origin/master`, and `origin/HEAD` point to the expected commit.

Do not skip verification, PM2 deployment for user-facing changes, or the GitHub push unless the user explicitly requests otherwise.
