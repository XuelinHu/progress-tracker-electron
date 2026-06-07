const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  saveJson: (payload) => ipcRenderer.invoke("save-json", payload),
  saveCsv: (payload) => ipcRenderer.invoke("save-csv", payload),
  openJson: () => ipcRenderer.invoke("open-json"),
  onMenuAction: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on("menu-action", handler);
    return () => ipcRenderer.removeListener("menu-action", handler);
  },
});
