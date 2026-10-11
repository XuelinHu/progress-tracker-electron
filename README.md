# 科研进度管理平台

<p align="center">
  <img height="20" alt="Electron 35" src="https://img.shields.io/badge/electron-35-47848F" />
  <img height="20" alt="React 19.1.0" src="https://img.shields.io/badge/react-19.1.0-61DAFB" />
  <img height="20" alt="Vite 7.0.0" src="https://img.shields.io/badge/vite-7.0.0-646CFF" />
  <img height="20" alt="TypeScript 5.8.3" src="https://img.shields.io/badge/typescript-5.8.3-3178C6" />
</p>

这是一个 Electron + Vite + React 的科研进度管理平台，用于按 4 个类别管理软著、专利、论文、比赛进程。

## 功能

- 5 个数据类别：软著、专利、论文、比赛、项目。
- 按 `1` / `2` / `3` / `4` / `5` / `6` / `7` 可直接切换页面；五个数据类别使用不同颜色。
- 状态包含：返修中、进行中、已提交系统、已提交、开发完成、暂缓、等待、其他、结束；每个状态都有独立颜色和可配置优先级。
- 日期列按栏目配置显示，例如论文使用“阶段日期”，比赛和项目使用“报名日期 / 结束日期”。
- 点击某一行进程会直接在右侧打开编辑区，当前记录的字段都可编辑。
- 表格单元格支持直接编辑，已有历史记录也支持编辑、追加和删除。
- 支持搜索、状态筛选、PostgreSQL 数据库存储、导出 JSON、导入 JSON、导出当前类别 CSV，并保留 WebDAV 云端同步。

## 运行

安装依赖：

```bash
npm install
```

启动浏览器预览：

```bash
npm run dev
```

生产预览服务会通过 `scripts/preview-server.cjs` 读写 PostgreSQL。复制 `.env.example` 为本地 `.env` 后填写数据库和 WebDAV 配置；`.env` 已被忽略，不要提交真实账号、密码或连接串。网页 API 使用统一身份服务的 OIDC access token；登录走 Authorization Code + PKCE，API 验证 issuer、签名、过期时间、`account` audience 和本应用 `azp`。

当前数据库约定：

- 数据库：`progress_tracker_electron`
- 表：`app_state`
- 主键：`id`，默认值为 `main`
- 数据字段：`data JSONB`，保存 1-7 页面记录、知识图谱、优先级配置和导出同步所需的整份状态
- 时间字段：`created_at`、`updated_at`

生产预览服务启动后，前端通过 `/api/state` 从 PostgreSQL 读取和写入数据，不把业务数据持久化到浏览器 `localStorage` 或服务器本地 JSON 文件。WebDAV 同步通过 `/api/dav/sync` 和 `/api/dav/restore` 保留，两个接口都由后端以 PostgreSQL 当前状态为唯一事实源。

启动桌面应用：

```bash
npm start
```

如果 Electron 二进制下载较慢，可以先跳过下载完成前端验证：

```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install
npm run dev
```

语法和生产构建检查：

```bash
npm run check
```

## PM2 开机自启

生产预览使用 PM2 管理，服务名为 `progress-tracker-electron`。首次配置或 PM2 进程列表丢失时，在项目根目录执行：

```bash
npm run build
pm2 start npm --name progress-tracker-electron -- run preview
pm2 save
```

为当前用户安装 systemd 自启动单元（仅首次需要，需管理员权限）：

```bash
sudo env PATH=$PATH:/home/xuelin/.nvm/versions/node/v24.14.1/bin pm2 startup systemd -u xuelin --hp /home/xuelin
pm2 save
```

代码更新后的重建与服务重启：

```bash
npm run build
pm2 restart progress-tracker-electron
pm2 save
```

验证 PM2 自启动和预览服务：

```bash
systemctl is-enabled pm2-xuelin
pm2 status
curl -fsS http://127.0.0.1:4027/ > /dev/null
```

<!-- codex-runtime-config:start -->
## 运行配置与数据存储

- Web/PM2 默认端口：`4027`。
- 本机访问：`http://127.0.0.1:4027/`。
- FRP 外网访问：`http://47.120.48.245:14027/`。
- Electron 联调地址：`electron/main.cjs` 默认加载 `http://localhost:4027`。
- 预览服务入口：`npm run preview` -> `scripts/preview-server.cjs`。
- LAN HTTPS 前端入口：`npm run dev:https` -> `https://192.168.1.9:4093`；证书和私钥需由 LAN 开发 CA 单独签发并保存在忽略目录，不提交到 Git。
- 数据库类型：PostgreSQL。
- 本机开发数据库名称：`progress_tracker_electron_dev`，由独立 `progress_tracker_electron_app` 角色拥有；LAN 开发实例使用同名独立数据库和角色。
- `npm run db:provision:local` 仅连接本机 `127.0.0.1:5432`，创建缺失的开发库/应用角色、生成随机口令、应用 migration，并将连接信息写到 Git 忽略的 `.env.local`。它不会覆盖已有环境文件或接管非空/所有者不符的数据库。
- `npm run db:provision:lan` 固定连接 LAN 主机自身的 `127.0.0.1:5433`，只读取当前私有 `.env` 中授权管理员凭据，创建空 `_dev` 库/应用角色并写入忽略的 `.env.local`；目标库或角色已存在时会停止，不改旧数据库。
- 默认连接变量：`PGHOST=127.0.0.1`、`PGPORT=5432`、`PGDATABASE=progress_tracker_electron_dev`、`PGUSER=progress_tracker_electron_app`；真实口令只存在于 `.env.local`。
- 核心表：`app_state`，默认状态主键 `APP_STATE_ID=main`，`data JSONB` 保存 1-7 类别页记录、知识图谱、日历事项、其他事项、优先级配置和同步状态。
- WebDAV：通过 `DAV_URL`、`DAV_USERNAME`、`DAV_PASSWORD`、`DAV_PROJECT` 配置云端备份；真实凭据只放本地 `.env`。
- OIDC：`OIDC_ISSUER=https://192.168.1.9:8042/realms/front`、`OIDC_CLIENT_ID=progress-tracker-electron-web`。浏览器使用 PKCE S256，校验 state 与 ID token 的 nonce、issuer、audience、expiry；短期 access/refresh token 放在标签页 `sessionStorage`，关闭标签页即清除，访问令牌过期前自动刷新。
- CORS：`OIDC_WEB_ORIGINS` 是逗号分隔的精确 origin allowlist；默认覆盖 LAN HTTPS、localhost 开发和 Capacitor `https://localhost`，不接受通配符来源。
- CA：如果 Node 不信任 LAN 开发 CA，须在启动 Node 前设置 `NODE_EXTRA_CA_CERTS`，该变量放进 `.env` 不会生效。例如从项目目录运行：`$env:NODE_EXTRA_CA_CERTS='../identity-service/tls/front-dev-ca.crt'; npm run preview`。浏览器也必须信任同一 CA。
- 数据归属：每个 OIDC `sub` 使用独立 `app_state` 行；历史 `id=main` 保持 `owner_sub IS NULL`，不会自动认领或导入。
- 数据库部署：`database/provision.ps1` 只读核验管理员连接、现有数据库 owner 和角色是否存在；它不创建对象、不改密码、不变更 owner。`database/provision-local.mjs` 是仅供本机开发使用的受限 provisioning 命令。迁移 runner 只接受明确的 `_dev/_development/_test` 名称，使用 advisory lock 和 SHA-256 checksum ledger；迁移 SQL授予应用角色 CRUD，服务启动只检查表。生产环境应使用独立 migration 身份；生产名 `progress_tracker_electron` 不可由本地 provisioning 命令修改。
- 并发写入：客户端提交 `x-state-revision`，版本冲突返回 HTTP 409，需刷新后重试，避免静默覆盖其他窗口修改。
- WebDAV：新备份位于 `<DAV_PROJECT>/users/<sub 的 SHA-256 摘要>/`，用户间隔离；旧的共享 `latest.json` 不会作为新用户备份恢复。
- 网络：局域网访问必须经 HTTPS 反向代理 `https://192.168.1.9:4093`；当前 Node 预览服务本身监听 HTTP，不能直接在不可信网络或 FRP HTTP 映射上承载 bearer token。`localhost:4027` 仅供本机开发。
- Electron：打包版只提供静态界面，不包含 PostgreSQL API 服务。部署必须提供 HTTPS 页面入口、受信任 API origin、CORS allowlist 与 OAuth redirect；API origin 从 `public/runtime-config.json` 读取，默认同源。不可将 PG 连接串或数据库口令打入 Electron 包。
- PostgreSQL 备份：使用 PostgreSQL 18 的 `pg_dump --format=custom` 导出本项目数据库；恢复前先恢复到隔离数据库并校验，再安排维护窗口恢复。不要把用户状态迁移到共享 `main` 行。
- 存储回归：`npm run test:storage` 会检查本地存储残留；真实 PostgreSQL 读写只在显式环境变量均提供且数据库名以 `_test` 结尾时运行，否则跳过，不读取 `.env`。
<!-- codex-runtime-config:end -->

## 打包

Windows 安装包：

```bash
npm run dist:win
```

macOS 安装包：

```bash
npm run dist:mac
```

打包前需要确保 Electron 二进制已正常安装。

## 启动端口

网页入口：4027；后台服务：8035。完整启动约定见 [PORTS.md](./PORTS.md)。
