// Optional browser regression. Run with Playwright, Express and Socket.IO installed.
// Simulates native keyboard viewport changes in the real pages without a device.
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const express = require("express");
const { Server } = require("socket.io");
const { chromium } = require("playwright");

const repo = path.resolve(__dirname, "..");
const size = { width: 844, height: 390 };
const android = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36";
const cases = [
  { file: "index.html", field: "#messageInput", send: "#sendBtn", surface: ".chat-input", edge: true },
  { file: "index.html", field: "#messageInput", send: "#sendBtn", surface: ".chat-input", edge: true, portrait: true },
  { file: "index.html", field: "#gifSearch", send: ".stk-close", surface: "#gifPicker", edge: true, picker: true },
  { file: "index.html", field: "#priv-input", send: "#priv-send", surface: "#priv-panel" },
  { file: "friend-chat.html?friend=bob", field: "#fc-input", send: "#fc-send", surface: "#app" },
  { file: "friend-chat.html?friend=bob", field: "#fc-e2ee-pass", send: ".fc-e2ee-open", surface: "#app" },
  { file: "friend-chat.html?friend=bob", field: "#fc-gif-search", send: "#fc-gif-picker .stk-close", surface: "#fc-gif-picker", picker: true },
  { file: "rooms.html?room=fixture", field: "#chatInput", send: "#chatSendBtn", surface: "#app" },
  { file: "bura.html", field: "#chatForm input", send: "#chatForm button", surface: "#chatDialog" },
  { file: "nardi.html", field: "#chatForm input", send: "#chatForm button", surface: "#chatDialog" },
  { file: "poker.html", field: "#pkChatInput", send: "#pkChatSendBtn", surface: "#chatPanel" },
  { file: "joker.html", field: "#chatInput", send: "#chatSendBtn", surface: "#chatPanel" },
  { file: "blackjack.html", field: "#bjChatInput", send: "#bjChatSendBtn", surface: "#chatPanel" },
  { file: "checkers.html", field: "#dmChatInput", send: "#dmChatSendBtn", surface: "#chatPanel" },
  { file: "chess.html", field: "#csChatInput", send: "#csChatSendBtn", surface: "#chatPanel" },
  { file: "imposter.html", field: "#imChatInput", send: "#imChatSendBtn", surface: "#chatPanel" },
  { file: "draw-guess.html", field: "#guessInput", send: "#guessSend", surface: "#guessBar", edge: true, stableBoard: true },
  { file: "draw-guess.html", field: "#guessInput", send: "#guessSend", surface: "#guessBar", edge: true, stableBoard: true, portrait: true },
  { file: "city.html", field: "#cityMessageInput", send: "#cityMessageSend", surface: "#cityMessageComposer" }
];

async function prepare(page, target) {
  if (target.file.startsWith("friend-chat.html")) {
    await page.locator("#fc-loading").waitFor({ state: "hidden" });
    await page.locator("#fc-input-bar").waitFor({ state: "visible" });
    assert(!(await page.locator("#fc-auth-screen").isVisible()), "friend chat authentication failed");
    assert(!(await page.locator("#fc-empty").isVisible()), "fixture message failed to load");
  }
  if (target.file.startsWith("rooms.html")) {
    await page.locator("#chatScreen.visible").waitFor();
    assert(!(await page.locator("#rmLoading").isVisible()), "room fixture did not finish loading");
  }
  if (target.file === "draw-guess.html") {
    await page.locator("#dgLoading").waitFor({ state: "hidden" });
    await page.locator("#setupScreen.visible").waitFor();
  }
  await page.evaluate(({ file, field, send, picker }) => {
    if (file === "index.html") {
      document.querySelector("#rulesGateAgree")?.click();
      document.querySelector("#nameModal").style.display = "none";
      setInputsEnabled(true);
      if (field === "#priv-input") document.querySelector("#priv-panel").style.display = "flex";
      if (picker) {
        document.querySelector("#gifBtn").click();
        document.querySelector('#gifPicker .stk-tab[data-tab="gif"]').click();
      }
    }
    if (file.startsWith("friend-chat.html") && picker) {
      document.querySelector("#fc-gif-btn").click();
      document.querySelector('#fc-gif-picker .stk-tab[data-tab="gif"]').click();
    }
    if (file === "city.html") document.querySelector("#cityMessageComposer").hidden = false;
    if (file === "draw-guess.html") {
      document.querySelector(".dg-screen.visible")?.classList.remove("visible");
      document.querySelector("#playScreen").classList.add("visible");
      document.querySelector("#guessBar").style.display = "flex";
    }
    const editor = document.querySelector(field);
    editor.closest("dialog")?.showModal();
    editor.closest("#chatPanel")?.classList.add("show");
    editor.disabled = false;
    editor.readOnly = false;
    editor.style.removeProperty("pointer-events");
    document.querySelector(send).style.removeProperty("display");
    editor.focus({ preventScroll: true });
  }, target);
  assert.equal(await page.locator(target.field).evaluate(el => el === document.activeElement), true);
}

async function measure(page, target) {
  return page.evaluate(async ({ field, send, surface }) => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const elements = [field, send, surface].map((selector, index) => {
      const el = document.querySelector(selector);
      const { left, width, top, bottom, height } = el.getBoundingClientRect();
      const reachable = index === 2 || el.contains(document.elementFromPoint(left + width / 2, top + height / 2));
      return { selector, top, bottom, height, reachable };
    });
    return { elements, keyboard: document.documentElement.classList.contains("gc-keyboard-open") };
  }, target);
}

async function assertFit(page, target, top, bottom) {
  const { elements, keyboard } = await measure(page, target);
  assert(keyboard, "the keyboard was not detected");
  for (const el of elements) {
    assert(el.height > 0 && el.top >= top - 2 && el.bottom <= bottom + 2,
      `${el.selector} is outside ${top}–${bottom}px: ${el.top}–${el.bottom}px`);
    assert(el.reachable, `${el.selector} is covered by another element`);
  }
  if (target.edge) {
    const surface = elements.at(-1);
    assert(Math.abs(surface.bottom - bottom) <= 2,
      `${surface.selector} leaves a gap above the keyboard: ${surface.bottom} instead of ${bottom}px`);
  }
}

async function setOverlay(page, height, offsetTop, event = "resize") {
  await page.evaluate(({ height, offsetTop, event }) => {
    window.setTestViewport({ height, offsetTop }, event);
  }, { height, offsetTop, event });
}

async function run() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  app.use(express.json());
  app.get("/api/priv/history", (_req, res) => res.json({
    messages: [{ from: "bob", text: "Keyboard fixture", ts: new Date().toISOString() }]
  }));
  app.use("/api", (_req, res) => res.json({
    success: true, username: "alice", profile: { username: "bob" }, friends: ["bob"], coins: 100, messages: []
  }));
  require(path.join(repo, "server-assets")).mountAssets(app, { root: repo });
  app.use(express.static(repo));
  io.on("connection", socket => {
    const authenticate = () => socket.emit("auth:authenticated", { username: "alice", friends: ["bob"], pendingRequests: [] });
    socket.on("auth:login", authenticate);
    socket.on("auth:token", authenticate);
    socket.on("auth:guest", authenticate);
    socket.on("rooms:join", () => socket.emit("rooms:room", { room: { id: "fixture", name: "Keyboard fixture" }, messages: [] }));
  });

  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CITY_QA_CHROME || undefined });
    const context = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true, userAgent: android, reducedMotion: "reduce" });
    await context.route("**/*", route => route.request().url().startsWith(base + "/") ? route.continue() : route.abort());
    await context.addInitScript(() => {
      if (location.pathname === "/index.html") {
        localStorage.removeItem("gaicani_auth_token");
        localStorage.removeItem("gaicani_auth_user");
      } else {
        localStorage.setItem("gaicani_auth_token", "local-keyboard-fixture");
        localStorage.setItem("gaicani_auth_user", "alice");
      }
      const native = window.visualViewport;
      const viewport = new EventTarget();
      let overlay = null;
      Object.defineProperties(viewport, {
        height: { get: () => overlay?.height ?? native.height },
        offsetTop: { get: () => overlay?.offsetTop ?? native.offsetTop },
        width: { get: () => native.width },
        scale: { get: () => native.scale }
      });
      Object.defineProperty(window, "visualViewport", { get: () => viewport });
      native.addEventListener("resize", () => viewport.dispatchEvent(new Event("resize")));
      window.setTestViewport = (value, event = "resize") => {
        overlay = value;
        viewport.dispatchEvent(new Event(event));
      };
    });
    const failures = [];
    for (const target of cases) {
      for (const mode of ["visual resize", "layout resize"]) {
        const page = await context.newPage();
        const pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        page.setDefaultTimeout(10000);
        const fullSize = target.portrait ? { width: 390, height: 844 } : size;
        await page.setViewportSize(fullSize);
        try {
          await page.goto(`${base}/${target.file}`);
          await page.waitForFunction(() => window.GaicaniViewport && document.documentElement.style.getPropertyValue("--gc-visible-height"));
          await prepare(page, target);
          let boardBefore;
          if (target.stableBoard) {
            await measure(page, target);
            boardBefore = await page.locator("#dgCanvas").boundingBox();
          }
          const assertBoardStable = async () => {
            if (!boardBefore) return;
            const board = await page.locator("#dgCanvas").boundingBox();
            assert(Math.abs(board.width - boardBefore.width) < 2, "the drawing shrank when the keyboard opened");
            assert(Math.abs(board.height - boardBefore.height) < 2, "the drawing changed aspect ratio");
          };
          if (mode === "visual resize") {
            const visibleHeight = target.portrait ? 570 : 182;
            const tightHeight = target.portrait ? 490 : 142;
            await setOverlay(page, visibleHeight, 22);
            await assertFit(page, target, 22, 22 + visibleHeight);
            await setOverlay(page, visibleHeight, 35, "scroll");
            await assertFit(page, target, 35, 35 + visibleHeight);
            await setOverlay(page, tightHeight, 35);
            await assertFit(page, target, 35, 35 + tightHeight);
            await assertBoardStable();
            if (target.field === "#messageInput") {
              // Android can report blur before it restores the visible viewport.
              await page.locator(target.field).blur();
              await assertFit(page, target, 35, 35 + tightHeight);
              await setOverlay(page, fullSize.height - 60, 0);
              await assertFit(page, target, 0, fullSize.height - 60);
            }
            await setOverlay(page, fullSize.height, 0);
          } else {
            const resizedHeight = target.portrait ? 500 : 160;
            await page.setViewportSize({ ...fullSize, height: resizedHeight });
            await assertFit(page, target, 0, resizedHeight);
            await assertBoardStable();
            if (target.field === "#messageInput") {
              await page.locator(target.field).blur();
              await assertFit(page, target, 0, resizedHeight);
            }
            await page.setViewportSize(fullSize);
          }
          await page.locator(target.field).blur();
          const restored = await measure(page, target);
          assert(!restored.keyboard, "keyboard layout did not reset");
          if (target.edge && !target.stableBoard) {
            assert(Math.abs(restored.elements.at(-1).bottom - fullSize.height) <= 2,
              `${target.surface} did not return to the bottom after the keyboard closed`);
          }
          assert.deepEqual(pageErrors, [], "page errors");
        } catch (error) {
          failures.push(`${target.file} ${target.field} (${mode}): ${error.message}`);
        } finally {
          await page.close();
        }
      }
    }
    assert.deepEqual(failures, [], failures.join("\n"));
    console.log(`PASS: ${cases.length} Android-style keyboard surfaces with visual and layout resizing`);
  } finally {
    await browser?.close();
    await new Promise(resolve => io.close(resolve));
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
