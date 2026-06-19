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

4. Only after verification passes, commit all task-related changes locally. Do not push to GitHub unless the user explicitly asks for a push:

```bash
git add <task-related-files>
git commit -m "<clear commit message>"
```

5. Confirm the worktree is clean except explicitly preserved user/tool files, and confirm `HEAD` points to the expected local commit.

Do not skip verification or PM2 deployment for user-facing changes unless the user explicitly requests otherwise. Do not push unless the user explicitly requests it.


<!-- headroom:rtk-instructions -->
# RTK (Rust Token Killer) - Token-Optimized Commands

When running shell commands, **always prefix with `rtk`**. This reduces context
usage by 60-90% with zero behavior change. If rtk has no filter for a command,
it passes through unchanged — so it is always safe to use.

## Key Commands
```bash
# Git (59-80% savings)
rtk git status          rtk git diff            rtk git log

# Files & Search (60-75% savings)
rtk ls <path>           rtk read <file>         rtk grep <pattern>
rtk find <pattern>      rtk diff <file>

# Test (90-99% savings) — shows failures only
rtk pytest tests/       rtk cargo test          rtk test <cmd>

# Build & Lint (80-90% savings) — shows errors only
rtk tsc                 rtk lint                rtk cargo build
rtk prettier --check    rtk mypy                rtk ruff check

# Analysis (70-90% savings)
rtk err <cmd>           rtk log <file>          rtk json <file>
rtk summary <cmd>       rtk deps                rtk env

# GitHub (26-87% savings)
rtk gh pr view <n>      rtk gh run list         rtk gh issue list

# Infrastructure (85% savings)
rtk docker ps           rtk kubectl get         rtk docker logs <c>

# Package managers (70-90% savings)
rtk pip list            rtk pnpm install        rtk npm run <script>
```

## Rules
- In command chains, prefix each segment: `rtk git add . && rtk git commit -m "msg"`
- For debugging, use raw command without rtk prefix
- `rtk proxy <cmd>` runs command without filtering but tracks usage
<!-- /headroom:rtk-instructions -->
