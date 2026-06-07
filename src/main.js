const fs = require("node:fs/promises");
const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron");

let mainWindow;

function sendMenuAction(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("menu-action", action);
  }
}

function createMenu() {
  const template = [
    {
      label: "文件",
      submenu: [
        {
          label: "新增任务",
          accelerator: "CommandOrControl+N",
          click: () => sendMenuAction("new-item"),
        },
        {
          label: "保存到本机",
          accelerator: "CommandOrControl+S",
          click: () => sendMenuAction("save"),
        },
        { type: "separator" },
        {
          label: "导入 JSON",
          accelerator: "CommandOrControl+O",
          click: () => sendMenuAction("import-json"),
        },
        {
          label: "导出 JSON",
          accelerator: "CommandOrControl+Shift+E",
          click: () => sendMenuAction("export-json"),
        },
        {
          label: "导出当前类别 CSV",
          accelerator: "CommandOrControl+E",
          click: () => sendMenuAction("export-csv"),
        },
        { type: "separator" },
        { role: "quit", label: "退出" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        {
          label: "搜索",
          accelerator: "CommandOrControl+F",
          click: () => sendMenuAction("focus-search"),
        },
        {
          label: "复制选中任务",
          accelerator: "CommandOrControl+D",
          click: () => sendMenuAction("duplicate-item"),
        },
        {
          label: "删除选中任务",
          accelerator: "Delete",
          click: () => sendMenuAction("delete-item"),
        },
        {
          label: "标记选中任务完成",
          accelerator: "CommandOrControl+Enter",
          click: () => sendMenuAction("complete-item"),
        },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "reload", label: "重新加载" },
        { role: "toggleDevTools", label: "开发者工具" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1120,
    minHeight: 720,
    title: "项目进度跟踪",
    backgroundColor: "#f6f7f9",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  createMenu();
}

app.whenReady().then(() => {
  ipcMain.handle("save-json", async (_event, payload) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "导出项目进度 JSON",
      defaultPath: "项目进度跟踪.json",
      filters: [{ name: "JSON 文件", extensions: ["json"] }],
    });

    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    await fs.writeFile(filePath, payload, "utf8");
    return { ok: true, filePath };
  });

  ipcMain.handle("save-csv", async (_event, payload) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "导出当前类别 CSV",
      defaultPath: "项目进度跟踪.csv",
      filters: [{ name: "CSV 文件", extensions: ["csv"] }],
    });

    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }

    await fs.writeFile(filePath, `\uFEFF${payload}`, "utf8");
    return { ok: true, filePath };
  });

  ipcMain.handle("open-json", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "导入项目进度 JSON",
      properties: ["openFile"],
      filters: [{ name: "JSON 文件", extensions: ["json"] }],
    });

    if (canceled || filePaths.length === 0) {
      return { ok: false, canceled: true };
    }

    const content = await fs.readFile(filePaths[0], "utf8");
    return { ok: true, filePath: filePaths[0], content };
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
