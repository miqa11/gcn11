const test = require("node:test");
const assert = require("node:assert/strict");
const { createReportStrikes, REPORT_TTL_MS } = require("../server-report-strikes");

function harness() {
  let stored = [], time = 1000;
  const bans = [];
  const options = {
    file: "reports.json",
    read: () => stored,
    write: (_file, data) => { stored = JSON.parse(data); },
    normalizeIP: ip => /^10\.0\.0\.\d+$/.test(ip) ? ip : null,
    onBan: ip => bans.push(ip),
    now: () => time,
  };
  return { options, bans, restart: () => createReportStrikes(options), later: (ms = REPORT_TTL_MS) => { time += ms; } };
}

test("each report expires at 48 hours without refreshing its timestamp on duplicates", () => {
  const h = harness(), tracker = h.restart();
  const report = ip => tracker.record(ip, "10.0.0.9", "abuse", "reporter", "target");
  assert.equal(report("10.0.0.1"), false);
  assert.equal(report("10.0.0.1"), false);
  assert.equal(tracker.entries.get("10.0.0.9").count, 1);
  h.later(REPORT_TTL_MS - 1);
  assert.equal(report("10.0.0.1"), false);
  assert.equal(report("10.0.0.2"), false);
  h.later(1);
  assert.equal(report("10.0.0.3"), false);
  assert.equal(tracker.entries.get("10.0.0.9").count, 2);
  assert.deepEqual(h.bans, []);
  // The first IP can report again after its previous vote has expired.
  assert.equal(report("10.0.0.1"), true);
  assert.deepEqual(h.bans, ["10.0.0.9"]);
  assert.equal(report("10.0.0.4"), false);
  assert.equal(tracker.entries.get("10.0.0.9").count, 3);
});

test("pruning removes all expired evidence from memory and disk without lifting the block", () => {
  const h = harness(), tracker = h.restart();
  for (const ip of ["10.0.0.1", "10.0.0.2", "10.0.0.3"]) tracker.record(ip, "10.0.0.9", "reason");
  h.later();
  tracker.prune();
  assert.equal(tracker.entries.size, 0);
  assert.equal(h.restart().entries.size, 0);
  assert.deepEqual(h.bans, ["10.0.0.9"]);
});

test("restart discards stale reports instead of using them for a fresh ban", () => {
  const h = harness();
  h.restart().record("10.0.0.1", "10.0.0.9", "reason");
  h.later();
  const restarted = h.restart();
  assert.equal(restarted.entries.size, 0);
  restarted.record("10.0.0.2", "10.0.0.9", "reason");
  restarted.record("10.0.0.3", "10.0.0.9", "reason");
  assert.equal(restarted.entries.get("10.0.0.9").count, 2);
  assert.deepEqual(h.bans, []);
});

test("legacy reports migrate with their original individual dates", () => {
  const h = harness();
  const timestamp = new Date(h.options.now()).toISOString();
  h.later(REPORT_TTL_MS - 1000);
  const recent = new Date(h.options.now()).toISOString();
  h.options.write("reports.json", JSON.stringify([["10.0.0.9", {
    reporters: ["10.0.0.1", "10.0.0.2"], firstReportAt: Date.parse(timestamp),
    reasons: [{ timestamp, reason: "old" }, { timestamp: recent, reason: "recent" }],
  }]]));
  const tracker = h.restart();
  h.later(1000);
  tracker.prune();
  const entry = tracker.entries.get("10.0.0.9");
  assert.equal(entry.count, 1);
  assert.deepEqual([...entry.reporters], ["10.0.0.2"]);
  assert.equal(entry.reasons[0].reason, "recent");
  assert.equal(h.restart().entries.get("10.0.0.9").count, 1);
});

test("reporter identity and permanent blocks survive restarts, while an admin reset persists", () => {
  const h = harness();
  h.restart().record("10.0.0.1", "10.0.0.9", "reason");
  const restarted = h.restart();
  restarted.record("10.0.0.1", "10.0.0.9", "reason");
  restarted.record("10.0.0.2", "10.0.0.9", "reason");
  assert.equal(restarted.entries.get("10.0.0.9").count, 2);
  restarted.record("10.0.0.3", "10.0.0.9", "reason");
  const third = h.restart();
  assert.deepEqual(h.bans, ["10.0.0.9", "10.0.0.9"]);
  assert(third.clear("10.0.0.9"));
  assert.equal(h.restart().entries.size, 0);
});

test("self-reports and unidentified addresses never count", () => {
  const h = harness(), tracker = h.restart();
  for (const [from, to] of [["10.0.0.1", "10.0.0.1"], ["unknown", "10.0.0.1"], ["10.0.0.1", "unknown"]]) {
    assert.equal(tracker.record(from, to, "reason"), false);
  }
  assert.equal(tracker.entries.size, 0);
  assert.deepEqual(h.bans, []);
});

test("a failed save rolls back the vote so a retry can complete", () => {
  const h = harness(), options = { ...h.options };
  const tracker = createReportStrikes(options);
  tracker.record("10.0.0.1", "10.0.0.9", "reason");
  const write = options.write;
  // The dependency throws before the third report is committed.
  let fail = true;
  const retrying = createReportStrikes({ ...options, write: (...args) => {
    if (fail) throw Error("disk unavailable");
    write(...args);
  } });
  assert.throws(() => retrying.record("10.0.0.2", "10.0.0.9", "reason"), /disk unavailable/);
  assert.equal(retrying.entries.get("10.0.0.9").count, 1);
  fail = false;
  retrying.record("10.0.0.2", "10.0.0.9", "reason");
  assert.equal(retrying.record("10.0.0.3", "10.0.0.9", "reason"), true);
});
