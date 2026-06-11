const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("node:path");

const isDev = !app.isPackaged;

ipcMain.handle("open-external", async (_event, rawUrl) => {
  try {
    const url = new URL(String(rawUrl ?? ""));
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    await shell.openExternal(url.toString());
    return true;
  } catch {
    return false;
  }
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 700,
    title: "项目进度跟踪桌面端",
    backgroundColor: "#f7f8fb",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:4003");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

const template = [
  {
    label: "文件",
    submenu: [
      { role: "reload", label: "重新加载" },
      { role: "toggleDevTools", label: "开发者工具" },
      { type: "separator" },
      { role: "quit", label: "退出" },
    ],
  },
  {
    label: "编辑",
    submenu: [
      { role: "undo", label: "撤销" },
      { role: "redo", label: "重做" },
      { type: "separator" },
      { role: "cut", label: "剪切" },
      { role: "copy", label: "复制" },
      { role: "paste", label: "粘贴" },
      { role: "selectAll", label: "全选" },
    ],
  },
];

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
