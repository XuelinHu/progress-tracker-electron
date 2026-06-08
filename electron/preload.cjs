const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  platform: process.platform,
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
});
