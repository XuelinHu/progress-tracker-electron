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

function sendJson(response, payload) {
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function startTestServer() {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

    if (url.pathname === "/api/state") {
      sendJson(response, request.method === "GET" ? { ok: true, state: null } : { ok: true });
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
    server.listen(0, "127.0.0.1", () => resolve(server));
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
  return { evaluate, socket };
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
    await clickButton(page, ".global-data-actions button", "知识图谱", ".graph-workspace");

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
