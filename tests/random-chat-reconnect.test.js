"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRandomChatReconnect } = require("../server-random-chat-reconnect");

function setup() {
  const activeUsernames = new Set(["one", "two"]);
  const timers = new Set();
  const reconnect = createRandomChatReconnect({
    activeUsernames,
    graceMs: 100,
    setTimer(fn) { timers.add(fn); return fn; },
    clearTimer(fn) { timers.delete(fn); },
  });
  const socket = (name, device = name) => ({
    id: name + "-socket", userName: name, connected: true, _did: device, events: [],
    emit(event, data) { this.events.push({ event, data }); },
  });
  const one = socket("one"), two = socket("two");
  one.partner = two;
  two.partner = one;
  function park(s) { s.connected = false; assert(reconnect.park(s)); }
  function expire() { for (const fn of [...timers]) if (timers.has(fn)) fn(); }
  return { reconnect, one, two, socket, park, expire, activeUsernames };
}

test("random chat queues text and stickers once and restores before delivering them", () => {
  const { reconnect, one, two, socket, park } = setup();
  park(two);
  assert.equal(one.partner, two);
  assert.deepEqual(one.events.map(e => e.event), ["partnerReconnecting", "partnerTyping"]);
  assert(reconnect.deliver(two, "message", { text: "hello", messageId: "1" }));
  assert(reconnect.deliver(two, "sticker", { id: "love", messageId: "2" }));
  assert(reconnect.deliver(two, "sticker", { id: "love", messageId: "2" }));
  assert(!reconnect.restore(socket("two", "wrong device"), "two"));
  const back = socket("two");
  assert(reconnect.restore(back, "two"));
  assert.deepEqual(back.events.map(e => e.event), ["partnerRestored", "message", "sticker"]);
  assert(reconnect.deliver(back, "sticker", { id: "love", messageId: "2" }));
  assert.equal(back.events.length, 3);
  assert.equal(one.partner, back);
  assert.equal(one.events.at(-1).event, "partnerReconnected");
});

test("both partners can recover from simultaneous disconnects", () => {
  const { reconnect, one, two, socket, park } = setup();
  park(one);
  park(two);
  const first = socket("one");
  assert(reconnect.restore(first, "one"));
  assert.equal(first.partner, two);
  assert(reconnect.deliver(two, "message", { text: "back", messageId: "1" }));
  const second = socket("two");
  assert(reconnect.restore(second, "two"));
  assert.equal(first.partner, second);
  assert.equal(second.events.at(-1).data.text, "back");
});

test("expiry ends a parked chat once and releases its reserved name", () => {
  const { reconnect, one, two, socket, park, expire, activeUsernames } = setup();
  park(two);
  expire();
  assert.equal(one.partner, null);
  assert.equal(activeUsernames.has("two"), false);
  assert(!reconnect.restore(socket("two"), "two"));
  expire();
  assert.equal(one.events.filter(e => e.event === "partnerDisconnected").length, 1);
});
