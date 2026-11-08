"use strict";

const THRESHOLD = 3;
const REPORT_TTL_MS = 48 * 60 * 60 * 1000;

function isReportCurrent(report, at = Date.now()) {
  const timestamp = Date.parse(report?.timestamp);
  return Number.isFinite(timestamp) && timestamp > at - REPORT_TTL_MS;
}

function reportEntry(reports) {
  return {
    reports,
    count: reports.length,
    reporters: new Set(reports.map(report => report.reporterIP)),
    firstReportAt: Math.min(...reports.map(report => Date.parse(report.timestamp))),
    reasons: reports.map(({ reporterIP, ...reason }) => reason),
    names: new Set(reports.map(report => report.against).filter(Boolean)),
  };
}

function createReportStrikes({ file, read, write, normalizeIP, onBan, now = Date.now }) {
  const entries = new Map();

  function save() {
    write(file, JSON.stringify([...entries].map(([ip, entry]) => [ip, {
      ...entry, reporters: [...entry.reporters], names: [...entry.names],
    }])));
  }

  function prune(target) {
    const previous = new Map();
    const at = now();
    const candidates = target ? [[target, entries.get(target)]] : entries;
    for (const [ip, entry] of candidates) {
      if (!entry) continue;
      const reports = entry.reports.filter(report => isReportCurrent(report, at));
      if (reports.length === entry.reports.length) continue;
      previous.set(ip, entry);
      if (reports.length) entries.set(ip, reportEntry(reports));
      else entries.delete(ip);
    }
    if (!previous.size) return;
    try { save(); } catch (error) {
      for (const [ip, entry] of previous) entries.set(ip, entry);
      throw error;
    }
  }

  function record(reporterIP, targetIP, reason, reporterName, targetName) {
    const reporter = normalizeIP(reporterIP);
    const target = normalizeIP(targetIP);
    if (!reporter || !target || reporter === target) return false;
    prune(target);
    const previous = entries.get(target);
    if (previous?.reporters.has(reporter) || previous?.count >= THRESHOLD) return false;
    const entry = reportEntry([...(previous?.reports || []), {
      reporterIP: reporter,
      reason, by: reporterName || "unknown", against: targetName || "unknown",
      timestamp: new Date(now()).toISOString(),
    }]);
    entries.set(target, entry);
    try {
      save();
    } catch (error) {
      if (previous) entries.set(target, previous);
      else entries.delete(target);
      throw error;
    }
    if (entry.count < THRESHOLD) return false;
    onBan(target);
    return true;
  }

  function clear(ip) {
    const target = normalizeIP(ip);
    const previous = entries.get(target);
    if (!previous) return false;
    entries.delete(target);
    try { save(); } catch (error) {
      entries.set(target, previous);
      throw error;
    }
    return true;
  }

  // Each reporting IP keeps its own original timestamp, including legacy
  // entries whose reporters and reasons were stored in parallel arrays.
  let stored;
  let migrated = false;
  try { stored = read(file); } catch { stored = []; }
  for (const row of Array.isArray(stored) ? stored : []) {
    if (!Array.isArray(row) || row.length !== 2) continue;
    const [rawIP, data] = row;
    const ip = normalizeIP(rawIP);
    if (!ip || !data) continue;
    const legacy = Array.isArray(data.reporters) ? data.reporters.map((reporterIP, index) => ({
      ...data.reasons?.[index], reporterIP,
      timestamp: data.reasons?.[index]?.timestamp ||
        (Number.isFinite(data.firstReportAt) ? new Date(data.firstReportAt).toISOString() : null),
    })) : [];
    const reports = new Map();
    for (const report of Array.isArray(data.reports) ? data.reports : legacy) {
      const reporter = typeof report?.reporterIP === "string" && normalizeIP(report.reporterIP);
      if (!reporter || reporter === ip || !isReportCurrent(report, now())) continue;
      if (!reports.has(reporter)) reports.set(reporter, { ...report, reporterIP: reporter });
    }
    if (!reports.size) continue;
    const entry = reportEntry([...reports.values()].slice(0, THRESHOLD));
    if (!Array.isArray(data.reports) || data.reports.length !== entry.count) migrated = true;
    entries.set(ip, entry);
    if (entry.count >= THRESHOLD) onBan(ip);
  }
  // Remove expired data from disk even when nobody sends another report.
  if (Array.isArray(stored) && (migrated || stored.length !== entries.size)) save();
  return { entries, record, clear, prune };
}

module.exports = { createReportStrikes, REPORT_TTL_MS, isReportCurrent };
