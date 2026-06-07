const path = require("node:path");
const { app, BrowserWindow } = require("electron");

async function run() {
  const window = new BrowserWindow({
    show: false,
    width: 1360,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, "..", "src", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const errors = [];
  window.webContents.on("console-message", (_event, level, message) => {
    if (level >= 2) {
      errors.push(message);
    }
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    errors.push(`render-process-gone:${details.reason}`);
  });

  await window.loadFile(path.join(__dirname, "..", "src", "renderer", "index.html"));
  await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      requestAnimationFrame(() => {
        resolve({
          title: document.querySelector("#activeCategoryTitle")?.textContent || "",
          categories: [...document.querySelectorAll("#categoryList .category-button strong")].map((item) => item.textContent),
          rows: document.querySelectorAll("#tableBody tr").length,
          detailFields: document.querySelectorAll("#detailForm label").length,
          plannedDueHeaders: [...document.querySelectorAll("th")].filter((item) => item.textContent === "计划截止日期").length
        });
      });
    });
  `);

  const snapshot = await window.webContents.executeJavaScript(`
    ({
      title: document.querySelector("#activeCategoryTitle")?.textContent || "",
      categories: [...document.querySelectorAll("#categoryList .category-button strong")].map((item) => item.textContent),
      rows: document.querySelectorAll("#tableBody tr").length,
      detailFields: document.querySelectorAll("#detailForm label").length,
      plannedDueHeaders: [...document.querySelectorAll("th")].filter((item) => item.textContent === "计划截止日期").length
    })
  `);

  if (errors.length > 0) {
    throw new Error(`Renderer errors: ${errors.join(" | ")}`);
  }
  if (snapshot.categories.length !== 4) {
    throw new Error(`Expected 4 categories, got ${snapshot.categories.length}`);
  }
  if (snapshot.rows < 1) {
    throw new Error("Expected at least one seed row");
  }
  if (snapshot.plannedDueHeaders !== 1) {
    throw new Error("Expected active table to include one planned due date column");
  }

  console.log(JSON.stringify(snapshot, null, 2));
}

app.whenReady()
  .then(run)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    app.quit();
    process.exitCode = 1;
  });
