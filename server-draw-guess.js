"use strict";

const BOARD_WIDTH = 640;
const BOARD_HEIGHT = 480;
const SHAPES = new Set(["line", "rectangle", "ellipse"]);

function normalizeGuess(text) {
  return String(text || "").normalize("NFC").trim().toLowerCase()
    .replace(/[.,!?;:'"()]/g, "").replace(/\s+/g, " ");
}

function closeDrawGuess(guess, answer) {
  if (answer.length < 4 || Math.abs(guess.length - answer.length) > 1) return false;
  const [shorter, longer] = guess.length <= answer.length ? [guess, answer] : [answer, guess];
  let i = 0;
  while (i < shorter.length && shorter[i] === longer[i]) i++;
  if (shorter.length < longer.length) return shorter.slice(i) === longer.slice(i + 1);
  if (i === shorter.length) return false;
  return shorter.slice(i + 1) === longer.slice(i + 1)
    || (shorter[i] === longer[i + 1] && shorter[i + 1] === longer[i]
      && shorter.slice(i + 2) === longer.slice(i + 2));
}

function drawSettings(input, defaultDuration) {
  const options = input && typeof input === "object" ? input : {};
  const integer = (value, min, max, fallback) =>
    Number.isInteger(value) && value >= min && value <= max ? value : fallback;
  const customWords = typeof options.customWords === "string"
    ? [...new Map(options.customWords.slice(0, 6000).split(/[,\n]+/)
        .map(word => word.trim().replace(/\s+/g, " "))
        .filter(word => /^[\p{L}\p{N}][\p{L}\p{N}\p{M} -]{0,39}$/u.test(word) && normalizeGuess(word))
        .map(word => [normalizeGuess(word), word])).values()].slice(0, 100)
    : [];
  return {
    duration: integer(options.seconds, 20, 180, defaultDuration / 1000) * 1000,
    cycles: integer(options.cycles, 1, 5, 1),
    choices: integer(options.choices, 1, 5, 3),
    hints: integer(options.hints, 0, 4, 2),
    mode: ["normal", "hidden", "mixed"].includes(options.mode) ? options.mode : "normal",
    customWords,
    customOnly: options.customOnly === true && customWords.length > 0,
  };
}

function drawWordHints(word, count, hidden, random = Math.random) {
  const chars = [...word];
  if (hidden) return [{ at: 0, text: "•••" }];
  const available = chars.flatMap((char, i) => /[\p{L}\p{N}]/u.test(char) ? [i] : []);
  const masked = chars.map((char, i) => available.includes(i) ? "_" : char === " " ? "　" : char);
  const hints = [{ at: 0, text: masked.join(" ") }];
  const reveals = Math.min(count, Math.floor(available.length / 2));
  for (let i = 0; i < reveals; i++) {
    const [index] = available.splice(Math.floor(random() * available.length), 1);
    masked[index] = chars[index];
    hints.push({ at: (i + 1) / (reveals + 1), text: masked.join(" ") });
  }
  return hints;
}

function sanitizeDrawAction(action) {
  if (!action || typeof action !== "object" || typeof action.color !== "string" || !/^#[0-9a-f]{6}$/i.test(action.color)) return null;
  const { type, color, strokeId } = action;
  if (!Number.isSafeInteger(strokeId) || strokeId < 0) return null;
  const point = (x, y) => Number.isFinite(x) && Number.isFinite(y)
    && x >= 0 && y >= 0 && x <= BOARD_WIDTH && y <= BOARD_HEIGHT;
  if (type === "fill") {
    const { x, y } = action;
    return point(x, y) ? { type, color, strokeId, x, y } : null;
  }
  if (type !== undefined && !SHAPES.has(type)) return null;
  const { x1, y1, x2, y2, size } = action;
  if (!point(x1, y1) || !point(x2, y2) || !Number.isFinite(size) || size < 1 || size > 40) return null;
  return { type, color, strokeId, x1, y1, x2, y2, size };
}

module.exports = { closeDrawGuess, drawSettings, drawWordHints, normalizeGuess, sanitizeDrawAction };
