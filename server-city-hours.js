"use strict";

const { posix } = require("node:path");

const CITY_OPEN_SECOND = 21 * 3600;
const CITY_CLOSE_SECOND = 5 * 3600;
const SECONDS_PER_DAY = 24 * 3600;
const tbilisiClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tbilisi",
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});
const closedMessage = "ქალაქი დაკეტილია. გაიხსნება 21:00-ზე, თბილისის დროით.";

let cachedAt = Infinity;
let cached;

function cityHours(now = Date.now()) {
  if (now >= cachedAt && now < cached.nextChangeAt) return cached;

  const [hour, minute, second] = tbilisiClock.format(now).split(":").map(Number);
  const localSecond = hour * 3600 + minute * 60 + second;
  const open = localSecond >= CITY_OPEN_SECOND || localSecond < CITY_CLOSE_SECOND;
  const next = open ? CITY_CLOSE_SECOND : CITY_OPEN_SECOND;
  const secondsUntilChange = (next - localSecond + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  cachedAt = now;
  cached = { open, nextChangeAt: (Math.floor(now / 1000) + secondsUntilChange) * 1000 };
  return cached;
}

function mountCityHours(app) {
  app.get("/api/city/hours", (_req, res) => {
    const now = Date.now();
    const { open, nextChangeAt } = cityHours(now);
    res.set("Cache-Control", "no-store").json({ open, msUntilChange: nextChangeAt - now });
  });

  // Match decoded and normalized URLs before the HTML asset handler and static files.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    let pathname;
    try {
      pathname = posix.normalize(decodeURIComponent(req.path).replace(/\\/g, "/")).toLowerCase();
    } catch {
      return next();
    }
    if (pathname !== "/city.html" && pathname !== "/city.html/") return next();
    if (cityHours().open) return next();
    res.set("Cache-Control", "no-store").redirect(302, "/dashboard.html");
  });
}

function guardCityEvents(socket) {
  socket.use((packet, next) => {
    const [event] = packet;
    const cityEvent = typeof event === "string" && (event.startsWith("city:") || event.startsWith("casino:"));
    if (!cityEvent || cityHours().open) return next();
    if (event === "city:join") socket.emit("city:closed");
    const ack = packet[packet.length - 1];
    if (typeof ack === "function") ack({ error: closedMessage });
  });
}

module.exports = { cityHours, mountCityHours, guardCityEvents };
