"use strict";

const INACTIVITY_MS = 15 * 24 * 60 * 60 * 1000;

function lastActivityAt(user) {
  const dates = [user.createdAt, user.lastIPAt, user.lastSeenAt, user.lastActivityAt];
  return Math.max(0, ...dates.map(value => {
    const time = typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : NaN;
    return Number.isFinite(time) ? time : 0;
  }));
}

function inactiveAccounts(users, onlineSockets, now = Date.now()) {
  const candidates = [];
  for (const [username, user] of users) {
    if (user.isAdmin || user.isGuest || user.isPro || onlineSockets.get(username)?.size) continue;
    if (user.buraEscrow || user.nardiEscrow) continue;
    const last = lastActivityAt(user);
    if (last > 0 && now - last >= INACTIVITY_MS) candidates.push(username);
  }
  return candidates;
}

module.exports = { INACTIVITY_MS, lastActivityAt, inactiveAccounts };
