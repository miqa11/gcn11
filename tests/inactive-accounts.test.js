"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { INACTIVITY_MS, inactiveAccounts } = require("../server-inactive-accounts");

test("15-day inactivity uses the newest activity and protects online or special accounts", () => {
  const now = Date.UTC(2026, 10, 3);
  const old = new Date(now - INACTIVITY_MS).toISOString();
  const users = new Map([
    ["eligible", { createdAt: old }],
    ["just-active", { createdAt: old, lastIPAt: now - INACTIVITY_MS + 1 }],
    ["seen-later", { createdAt: old, lastSeenAt: now - 1000 }],
    ["verified", { createdAt: old, lastActivityAt: now - 1000 }],
    ["online", { createdAt: old, appearOffline: true }],
    ["admin", { createdAt: old, isAdmin: true }],
    ["vip", { createdAt: old, isPro: true }],
    ["guest", { createdAt: old, isGuest: true }],
    ["escrow", { createdAt: old, buraEscrow: { amount: 30 } }],
    ["unknown", { createdAt: "invalid" }]
  ]);
  const online = new Map([["online", new Set(["connected-socket"])]]);
  assert.deepEqual(inactiveAccounts(users, online, now), ["eligible"]);
});
