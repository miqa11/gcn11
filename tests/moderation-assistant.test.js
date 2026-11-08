"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createClassifier, createModerationAssistant } = require("../server-moderation-assistant");

function fixture(options = {}) {
  let timestamp = Date.UTC(2026, 10, 3);
  let saved = options.saved;
  const users = new Map([
    ["bad", { username: "bad", passwordHash: "a" }],
    ["also bad", { username: "also bad", passwordHash: "b" }],
    ["clean", { username: "clean", passwordHash: "c" }],
    ["support", { username: "Support", passwordHash: "d", isAdmin: true }],
    ["guest", { username: "guest", passwordHash: "e", isGuest: true }]
  ]);
  const calls = [], notifications = [];
  const ips = new Map([["bad", "192.0.2.1"]]);
  const assistant = createModerationAssistant({
    users,
    matches: name => name.includes("bad"),
    classifier: options.classifier,
    blockableIp: lc => ips.get(lc),
    applyName: lc => { calls.push(["name", lc]); users.get(lc).nameBlocked = true; },
    applyIp: (ip, username) => calls.push(["ip", ip, username]),
    read: () => saved,
    write: next => { saved = structuredClone(next); },
    notify: (added, total) => notifications.push([added, total]),
    now: () => timestamp
  });
  return { users, calls, notifications, ips, assistant, advance: ms => { timestamp += ms; }, get saved() { return saved; } };
}

test("background scan proposes and notifies without executing, then a matching approval can execute only once", async () => {
  const { assistant, calls, notifications } = fixture();
  await assistant.scan();
  await assistant.scan();
  assert.deepEqual(notifications, [[2, 2]]);
  const ids = assistant.view().rows.map(row => row.id);
  assert.deepEqual(calls, []);
  assert.equal(assistant.approve("support-session", "bad").error, "approval_required");
  const preview = assistant.prepare("support-session", "name", ids);
  assert.deepEqual(preview.usernames, ["bad", "also bad"]);
  assert.deepEqual(calls, []);
  assert.equal(assistant.approve("other-session", preview.token).error, "approval_required");
  assert.equal(assistant.approve("support-session", preview.token).count, 2);
  assert.deepEqual(calls, [["name", "bad"], ["name", "also bad"]]);
  assert.equal(assistant.approve("support-session", preview.token).error, "approval_required");
  assert.equal(assistant.view().history.length, 2);
});

test("expired, renamed, recreated and changed-IP targets cannot be approved", async () => {
  const { assistant, advance, users, calls, ips } = fixture();
  await assistant.scan();
  const [bad, other] = assistant.view().rows;
  let preview = assistant.prepare("support", "name", [bad.id]);
  advance(60_000);
  assert.equal(assistant.approve("support", preview.token).error, "approval_required");
  preview = assistant.prepare("support", "name", [bad.id, other.id]);
  users.set("also bad", { username: "also bad", passwordHash: "new account" });
  assert.equal(assistant.approve("support", preview.token).error, "stale");
  preview = assistant.prepare("support", "ip", [bad.id]);
  assert.equal(preview.ip, "192.0.2.1");
  ips.set("bad", "192.0.2.2");
  assert.equal(assistant.approve("support", preview.token).error, "ip_unavailable");
  preview = assistant.prepare("support", "ip", [bad.id]);
  users.get("bad").username = "renamed";
  assert.equal(assistant.approve("support", preview.token).error, "stale");
  assert.deepEqual(calls, []);
});

test("dismissals survive restart and AI stays off until enabled", async () => {
  let submitted;
  const f = fixture({ classifier: async names => { submitted = names; return new Map([[0, "insult"]]); } });
  await f.assistant.scan();
  assert.equal(submitted, undefined);
  const id = f.assistant.view().rows[0].id;
  const dismissed = f.assistant.prepare("support", "dismiss", [id]);
  assert.equal(f.assistant.approve("support", dismissed.token).ok, true);
  f.assistant.setAI(true);
  await f.assistant.scan();
  assert.deepEqual(submitted, ["clean"]);
  assert.equal(f.assistant.view().rows.find(row => row.username === "clean").source, "ai");
  assert.deepEqual(f.calls, []);
  const restart = fixture({ saved: f.saved });
  await restart.assistant.scan();
  assert.equal(restart.assistant.view().rows.some(row => row.username === "bad"), false);
  assert.equal(restart.assistant.view().history[0].action, "dismiss");
});

test("AI is sent usernames only and unexpected model indexes or reasons are rejected", async () => {
  let request;
  const classifier = createClassifier({ apiKey: "test-secret", fetchImpl: async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, text: async () => JSON.stringify({ choices: [{
      finish_reason: "stop", message: { content: JSON.stringify({ flags: [{ index: 0, reason: "delete" }] }) }
    }] }) };
  } });
  await assert.rejects(classifier(["test username"]), /Invalid AI flag/);
  assert.deepEqual(JSON.parse(request.messages[1].content), ["test username"]);
});
