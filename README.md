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

生产预览服务会通过 `scripts/preview-server.cjs` 读写 PostgreSQL。复制 `.env.example` 为本地 `.env` 后填写数据库和 WebDAV 配置；`.env` 已被忽略，不要提交真实账号、密码或连接串。

当前数据库约定：

- 数据库：`progress_tracker_electron`
- 表：`app_state`
- 主键：`id`，默认值为 `main`
- 数据字段：`data JSONB`，保存 1-7 页面记录、知识图谱、优先级配置和导出同步所需的整份状态
- 时间字段：`created_at`、`updated_at`

生产预览服务启动后，前端通过 `/api/state` 从 PostgreSQL 读取和写入数据，不再把业务数据持久化到浏览器 `localStorage`。WebDAV 同步仍通过 `/api/dav/sync` 和 `/api/dav/latest` 保留，用于云端备份和云端同步本地。

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
