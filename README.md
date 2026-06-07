# 项目进度跟踪桌面端

这是 Electron 桌面台账应用，用于按 Excel 的 4 个 sheet 管理项目进度。

## 功能

- 4 个可配置类别：软著、专利、论文、比赛。
- 每个类别都使用 Excel 原 sheet 表头，并统一追加“计划截止日期”列。
- 默认数据来自 `C:\Users\De\Desktop\todo.xlsx`。
- 支持新增、复制、删除、编辑、搜索、状态筛选、到期筛选。
- 支持快捷操作：按当前类别真实状态快速设置状态，快速设置截止日期。
- 支持本机保存、导出 JSON、导入 JSON、导出当前类别 CSV。
- 支持菜单快捷键：`Ctrl+N`、`Ctrl+S`、`Ctrl+E`、`Ctrl+Shift+E`、`Ctrl+Enter`。

## 运行

先安装依赖：

```bash
npm install
```

启动桌面应用：

```bash
npm start
```

语法检查：

```bash
npm run check
```

## 打包

Windows 安装包和免安装版：

```bash
npm run dist:win
```

输出目录：

```text
dist/
```

macOS 需要在苹果电脑上执行：

```bash
npm install
npm run dist:mac
```

Windows 环境不适合直接生成可交付的 macOS `.dmg` / `.app`，正式发布还需要在 macOS 上做签名和公证。

## 表头配置

表头模板集中在：

```text
src/data/categories.js
```

如果后续提供 Excel 原件，可把 4 个类别的真实表头替换到该文件的 `fields` 中。每个类别需要保留或新增：

```text
plannedDueDate / 计划截止日期
```

这样应用仍能正确计算逾期、7 天内到期和快捷截止日期。
"# progress-tracker-electron" 
