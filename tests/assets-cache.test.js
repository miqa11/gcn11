"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { mountAssets } = require("../server-assets");

const root = path.join(__dirname, "..");

test("HTML fingerprints manually versioned assets and keeps SVG fragments", () => {
  let serve;
  mountAssets({ get() {}, use(handler) { serve = handler; } }, { root });
  function html(url) {
    let body;
    serve({ method: "GET", path: url }, {
      setHeader(name, value) { if (name === "Cache-Control") assert.equal(value, "public, no-cache"); },
      type() { return this; },
      send(value) { body = value; }
    }, () => assert.fail("HTML route was not handled"));
    return body;
  }
  assert.match(html("/city.html"), /src="\/city\.js\?v=[a-f0-9]{10}"/);
  assert.match(html("/dashboard.html"), /href="\/local-party-symbols\.svg\?v=[a-f0-9]{10}#imposter-mark"/);
});

function worker() {
  const origin = "https://example.test";
  const entries = new Map();
  const handlers = new Map();
  const fetched = [];
  let responseHeaders = { "Cache-Control": "public, max-age=31536000, immutable" };
  let offline = false;
  let responseStatus = 200;
  let responseRedirected = false;
  const cache = {
    match: async key => entries.get(typeof key === "string" ? key : key.url),
    put: async (key, value) => { entries.set(typeof key === "string" ? key : key.url, value); }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "sw.js"), "utf8"), {
    self: { location: { origin }, addEventListener: (name, handler) => handlers.set(name, handler) },
    caches: { open: async () => cache, match: cache.match },
    URL,
    fetch: async request => {
      fetched.push(request.url);
      if (offline) throw new Error("offline");
      const response = {
        url: request.url, status: responseStatus, redirected: responseRedirected,
        headers: new Headers(responseHeaders), text: async () => request.url,
        clone() { return { ...this }; }
      };
      return response;
    }
  });
  async function request(pathname, { mode = "cors", headers = {} } = {}) {
    let result;
    const jobs = [];
    handlers.get("fetch")({
      request: { url: origin + pathname, method: "GET", mode, headers: new Headers(headers) },
      waitUntil(promise) { jobs.push(promise); },
      respondWith(promise) { result = promise; }
    });
    const response = await result;
    await Promise.all(jobs);
    return response;
  }
  return {
    origin, request, fetched, entries,
    set offline(value) { offline = value; },
    set headers(value) { responseHeaders = value; },
    set status(value) { responseStatus = value; },
    set redirected(value) { responseRedirected = value; }
  };
}

test("fingerprinted assets reuse matching bytes and fetch a changed version", async () => {
  const sw = worker();
  const old = "/city.js?v=001122aabb";
  const next = "/city.js?v=112233aabb";
  await sw.request(old);
  assert.equal(await (await sw.request(old)).text(), sw.origin + old);
  assert.equal(sw.fetched.length, 1);
  await sw.request(next);
  assert.equal(sw.fetched.length, 2);
  assert.equal(sw.entries.size, 1);
  sw.headers = { "Cache-Control": "public, max-age=0" };
  await sw.request(old);
  assert.equal(sw.fetched.length, 3);
  sw.offline = true;
  assert.equal(await (await sw.request(next)).text(), sw.origin + next);
  await assert.rejects(sw.request(old), /offline/);
});

test("network-first pages keep a valid offline copy and bypass private requests", async () => {
  const sw = worker();
  sw.headers = { "Cache-Control": "public, no-cache" };
  await sw.request("/dashboard.html", { mode: "navigate" });
  sw.status = 500;
  assert.equal((await sw.request("/dashboard.html", { mode: "navigate" })).status, 500);
  sw.status = 200;
  sw.redirected = true;
  await sw.request("/city.html", { mode: "navigate" });
  sw.redirected = false;
  sw.headers = {};
  await sw.request("/cookie-authenticated", { mode: "navigate" });
  assert(!sw.entries.has(sw.origin + "/cookie-authenticated"));
  sw.headers = { "Cache-Control": "private, no-store" };
  await sw.request("/private-response");
  assert.equal(await sw.request("/private-photos/chat.jpg"), undefined);
  assert.equal(await sw.request("/api/city/hours"), undefined);
  assert.equal(await sw.request("/preview", { headers: { Authorization: "Bearer local-test" } }), undefined);
  assert.equal(sw.entries.size, 1);
  sw.offline = true;
  assert.equal((await sw.request("/dashboard.html", { mode: "navigate" })).status, 200);
  await assert.rejects(sw.request("/missing.js"), /offline/);
});
