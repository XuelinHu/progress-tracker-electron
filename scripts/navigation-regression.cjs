const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const categoryNames = [
  "软著",
  "专利",
  "论文",
  "比赛",
  "项目",
  "活动",
  "问题记录",
  "其他事项",
];
const mimeByExt = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function localIsoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const todayIso = localIsoDate();
const previousDayIso = localIsoDate(-1);
const calendarRegressionItemId = "calendar-drag-regression";
const regressionRecordId = "graph-font-regression";
const regressionState = {
  version: 5,
  records: [
    {
      id: regressionRecordId,
      categoryId: "software",
      title: "知识图谱字体回归记录",
      status: "进行中",
      startDate: todayIso,
      endDate: todayIso,
      todo: "",
    },
    {
      id: "calendar-category-filter-patent",
      categoryId: "patent",
      title: "日历类别筛选专利记录",
      status: "进行中",
      startDate: todayIso,
      endDate: todayIso,
      todo: "",
    },
  ],
  calendarItems: [
    {
      id: calendarRegressionItemId,
      date: "",
      startDate: previousDayIso,
      endDate: previousDayIso,
      title: "日历拖拽回归事项",
      categoryId: "other",
      status: "进行中",
    },
  ],
  graph: {
    nodes: [
      {
        id: "graph-node-regression",
        position: { x: 80, y: 80 },
        data: { recordId: regressionRecordId, categoryId: "software" },
      },
    ],
    edges: [],
  },
};

function sendJson(response, payload) {
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function startTestServer() {
  let savedState = null;
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

    if (url.pathname === "/api/state") {
      if (request.method === "GET") {
        sendJson(response, { ok: true, source: "postgresql", state: regressionState });
        return;
      }
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      savedState = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      sendJson(response, { ok: true, source: "postgresql" });
      return;
    }

    const relativePath = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const filePath = path.resolve(distDir, relativePath);
    if (!filePath.startsWith(`${distDir}${path.sep}`) && filePath !== path.join(distDir, "index.html")) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    try {
      const body = await fs.readFile(filePath);
      response.writeHead(200, {
        "content-type": mimeByExt[path.extname(filePath)] || "application/octet-stream",
      });
      response.end(body);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const body = await fs.readFile(path.join(distDir, "index.html"));
      response.writeHead(200, { "content-type": mimeByExt[".html"] });
      response.end(body);
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.getSavedState = () => savedState;
      resolve(server);
    });
  });
}

async function findChromium() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/snap/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("Chromium not found. Set CHROMIUM_PATH to run navigation regression tests.");
}

function getFreePort() {
  const server = http.createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startChromium() {
  const executable = await findChromium();
  const profileBase = executable.includes("/snap/")
    ? path.join(os.homedir(), "snap", "chromium", "common")
    : os.tmpdir();
  await fs.mkdir(profileBase, { recursive: true });
  const profileDir = await fs.mkdtemp(path.join(profileBase, "progress-navigation-"));
  const port = await getFreePort();
  const browser = spawn(
    executable,
    [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    if (browser.exitCode != null) throw new Error(`Chromium exited with code ${browser.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return { browser, port, profileDir };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  browser.kill("SIGTERM");
  throw new Error("Timed out while starting Chromium");
}

async function connectToPage(port, url, browserErrors) {
  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })
  ).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let commandId = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") {
      browserErrors.push(
        message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text,
      );
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      browserErrors.push(
        message.params.args.map((argument) => argument.value || argument.description).join(" "),
      );
    }
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++commandId;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const message = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (message.result.exceptionDetails) {
      throw new Error(message.result.exceptionDetails.exception?.description || "Browser evaluation failed");
    }
    return message.result.result.value;
  }

  await send("Runtime.enable");
  await send("Page.enable");
  return { evaluate, send, socket };
}

async function waitFor(page, expression, label, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await page.evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function clickButton(page, selector, text, expectedSelector) {
  const clicked = await page.evaluate(`(() => {
    const button = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((item) => item.textContent.includes(${JSON.stringify(text)}));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Expected a button containing "${text}"`);
  await waitFor(page, `document.querySelector(${JSON.stringify(expectedSelector)})`, text);
  assert.equal(
    await page.evaluate("document.querySelector('#root').childElementCount > 0"),
    true,
    `${text} must not unmount the React application`,
  );
  console.log(`PASS ${text}`);
}

async function verifyCalendarDropUsesTargetDate(page, server) {
  const dragged = await page.evaluate(`(() => {
    const source = [...document.querySelectorAll(".calendar-todo-card")]
      .find((item) => item.textContent.includes("日历拖拽回归事项"));
    const target = document.querySelector(".calendar-day.today");
    if (!source || !target) return false;
    const dataTransfer = new DataTransfer();
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
    return true;
  })()`);
  assert.equal(dragged, true, "Expected an unscheduled item and today's calendar cell");
  await waitFor(page, "document.querySelector('.calendar-schedule-modal')", "calendar schedule modal");
  assert.match(
    await page.evaluate("document.querySelector('.calendar-schedule-head')?.textContent || ''"),
    new RegExp(todayIso),
  );
  await page.evaluate("document.querySelector('.calendar-schedule-submit').click()");
  await waitFor(page, "!document.querySelector('.calendar-schedule-modal')", "calendar schedule save");

  const deadline = Date.now() + 4000;
  let savedItem;
  while (Date.now() < deadline) {
    savedItem = server
      .getSavedState()
      ?.calendarItems?.find((item) => item.id === calendarRegressionItemId);
    if (savedItem?.date === todayIso) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  assert.equal(savedItem?.date, todayIso, "Calendar date must use the drop target date");
  assert.equal(savedItem?.startDate, todayIso, "Start date must reset to the drop target date");
  assert.equal(savedItem?.endDate, todayIso, "End date must reset to the drop target date");
  console.log("PASS calendar drop defaults to today");
}

async function verifyCalendarCategoryButtons(page) {
  assert.equal(
    await page.evaluate("document.querySelectorAll('.calendar-category-filter-button').length"),
    7,
    "Calendar category filter must render All plus six category buttons",
  );
  assert.equal(
    await page.evaluate("Boolean(document.querySelector('select[aria-label=\"日历类别筛选\"]'))"),
    false,
    "Calendar category filter must not use a select menu",
  );

  await clickButton(
    page,
    ".calendar-category-filter-button",
    "专利",
    ".calendar-category-filter-button[aria-pressed='true']",
  );
  assert.match(
    await page.evaluate("document.querySelector('.calendar-record-list')?.textContent || ''"),
    /日历类别筛选专利记录/,
  );
  assert.doesNotMatch(
    await page.evaluate("document.querySelector('.calendar-record-list')?.textContent || ''"),
    /知识图谱字体回归记录/,
  );

  await clickButton(
    page,
    ".calendar-category-filter-button",
    "软著",
    ".calendar-category-filter-button[aria-pressed='true']",
  );
  let recordListText = await page.evaluate(
    "document.querySelector('.calendar-record-list')?.textContent || ''",
  );
  assert.match(recordListText, /日历类别筛选专利记录/);
  assert.match(recordListText, /知识图谱字体回归记录/);

  await clickButton(
    page,
    ".calendar-category-filter-button",
    "专利",
    ".calendar-category-filter-button[aria-pressed='true']",
  );
  recordListText = await page.evaluate(
    "document.querySelector('.calendar-record-list')?.textContent || ''",
  );
  assert.doesNotMatch(recordListText, /日历类别筛选专利记录/);
  assert.match(recordListText, /知识图谱字体回归记录/);

  await clickButton(
    page,
    ".calendar-category-filter-button",
    "全部",
    ".calendar-category-filter-button[aria-pressed='true']",
  );
  recordListText = await page.evaluate(
    "document.querySelector('.calendar-record-list')?.textContent || ''",
  );
  assert.match(recordListText, /日历类别筛选专利记录/);
  assert.match(recordListText, /知识图谱字体回归记录/);
  console.log("PASS calendar category quick filters");
}

async function verifyCalendarCategoryButtonsOnMobile(page) {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 150));
  const layout = await page.evaluate(`(() => {
    const group = document.querySelector(".calendar-category-filters");
    const buttons = [...document.querySelectorAll(".calendar-category-filter-button")];
    const rect = group?.getBoundingClientRect();
    return {
      groupWithinViewport: Boolean(rect && rect.left >= 0 && rect.right <= window.innerWidth),
      buttonsFit: buttons.every((button) => button.scrollWidth <= button.clientWidth),
    };
  })()`);
  assert.deepEqual(layout, { groupWithinViewport: true, buttonsFit: true });
  console.log("PASS calendar category filters fit mobile viewport");
}

async function run() {
  const server = await startTestServer();
  const chromium = await startChromium();
  const address = server.address();
  const browserErrors = [];
  let page;

  try {
    page = await connectToPage(
      chromium.port,
      `http://127.0.0.1:${address.port}/`,
      browserErrors,
    );
    await waitFor(page, "document.querySelector('.category-tabs')", "application navigation");

    for (const categoryName of categoryNames) {
      await clickButton(page, ".category-tab", categoryName, ".category-tab.active");
      const activeText = await page.evaluate(
        "document.querySelector('.category-tab.active')?.textContent || ''",
      );
      assert.match(activeText, new RegExp(categoryName));
    }

    await clickButton(page, ".global-data-actions button", "优先级配置", ".status-config-page");
    await clickButton(page, ".global-data-actions button", "日历", ".calendar-page");
    await verifyCalendarCategoryButtons(page);
    await verifyCalendarDropUsesTargetDate(page, server);
    await clickButton(page, ".global-data-actions button", "知识图谱", ".graph-workspace");
    assert.equal(
      await page.evaluate("getComputedStyle(document.querySelector('.graph-node-date-input')).fontSize"),
      "11.2px",
      "Knowledge graph date font must be 70% of the previous 16px size",
    );
    console.log("PASS knowledge graph date font scale");

    const browserStorage = await page.evaluate(`(async () => ({
      localStorage: Object.keys(localStorage),
      sessionStorage: Object.keys(sessionStorage),
      indexedDb: typeof indexedDB.databases === "function"
        ? (await indexedDB.databases()).map((database) => database.name)
        : [],
    }))()`);
    assert.deepEqual(browserStorage, { localStorage: [], sessionStorage: [], indexedDb: [] });
    console.log("PASS browser runtime has no local business storage");

    await clickButton(page, ".global-data-actions button", "日历", ".calendar-page");
    await verifyCalendarCategoryButtonsOnMobile(page);

    assert.deepEqual(browserErrors, [], `Browser errors:\n${browserErrors.join("\n")}`);
    console.log(`PASS all ${categoryNames.length + 3} navigation buttons`);
  } finally {
    page?.socket.close();
    if (chromium.browser.exitCode == null) {
      chromium.browser.kill("SIGTERM");
      await new Promise((resolve) => {
        chromium.browser.once("exit", resolve);
        setTimeout(resolve, 2000);
      });
    }
    await fs.rm(chromium.profileDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
