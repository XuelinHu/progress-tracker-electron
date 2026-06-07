# 项目进度跟踪桌面端

这是一个 Electron + Vite + React 的项目进度台账应用，用于按 4 个类别管理软著、专利、论文、比赛进程。

## 功能

- 4 个类别：软著、专利、论文、比赛。
- 按 `1` / `2` / `3` / `4` 可直接切换类别；四个类别使用不同颜色。
- 状态包含：开发中、开发已完成、已提交到系统、已结束、暂缓、其他；每个状态都有独立颜色。
- 表格第 3、4 列固定为“开始日期”和“结束日期”。
- 点击某一行进程会直接在右侧打开编辑区，当前记录的字段都可编辑。
- 表格单元格支持直接编辑，已有历史记录也支持编辑、追加和删除。
- 支持搜索、状态筛选、本地保存、导出 JSON、导入 JSON、导出当前类别 CSV。

## 运行

安装依赖：

```bash
npm install
```

启动浏览器预览：

```bash
npm run dev -- --port 5180
```

启动桌面应用：

```bash
npm start
```

如果 Electron 二进制下载较慢，可以先跳过下载完成前端验证：

```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install
npm run dev -- --port 5180
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
