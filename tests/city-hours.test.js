"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { cityHours, guardCityEvents } = require("../server-city-hours");

test("City hours include 21:00, span Tbilisi midnight, and exclude 05:00", () => {
  const cases = [
    ["2026-11-03T20:59:59.999+04:00", false, "2026-11-03T21:00:00+04:00"],
    ["2026-11-03T21:00:00+04:00", true, "2026-11-04T05:00:00+04:00"],
    ["2026-11-04T00:00:00+04:00", true, "2026-11-04T05:00:00+04:00"],
    ["2026-11-04T04:59:59.999+04:00", true, "2026-11-04T05:00:00+04:00"],
    ["2026-11-04T05:00:00+04:00", false, "2026-11-04T21:00:00+04:00"],
    ["2026-11-03T22:30:00+04:00", true, "2026-11-04T05:00:00+04:00"]
  ];
  for (const [now, open, next] of cases) {
    assert.deepEqual(cityHours(Date.parse(now)), { open, nextChangeAt: Date.parse(next) }, now);
  }
});

test("the city and casino sockets close at 05:00 while other site events pass", t => {
  let now = Date.parse("2026-11-04T04:59:59.999+04:00");
  t.mock.method(Date, "now", () => now);
  let middleware;
  const emitted = [];
  guardCityEvents({
    use: handler => { middleware = handler; },
    emit: event => emitted.push(event)
  });
  let passed = 0;
  const next = () => { passed++; };
  middleware(["city:join", null], next);
  assert.equal(passed, 1);

  now++;
  for (const event of ["city:join", "city:motion", "casino:spin"]) {
    let result;
    middleware([event, null, value => { result = value; }], next);
    assert.match(result.error, /21:00/);
  }
  assert.equal(passed, 1);
  assert.deepEqual(emitted, ["city:closed"]);
  middleware(["poker:join", {}], next);
  assert.equal(passed, 2);

  now = Date.parse("2026-11-04T21:00:00+04:00");
  middleware(["city:join", null], next);
  assert.equal(passed, 3);
});
