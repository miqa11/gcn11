const test = require("node:test");
const assert = require("node:assert/strict");
const { closeDrawGuess, drawSettings, drawWordHints, sanitizeDrawAction } = require("../server-draw-guess");

test("timed hints reveal distinct characters without revealing the whole answer", () => {
  assert.deepEqual(drawWordHints("სახლი", 4, false, () => 0), [
    { at: 0, text: "_ _ _ _ _" },
    { at: 1 / 3, text: "ს _ _ _ _" },
    { at: 2 / 3, text: "ს ა _ _ _" },
  ]);
  assert.deepEqual(drawWordHints("სახლი", 4, true), [{ at: 0, text: "•••" }]);
  assert.deepEqual(drawWordHints("a", 4, false), [{ at: 0, text: "_" }]);
  assert.deepEqual(drawWordHints("ღია კარი", 0, false), [{ at: 0, text: "_ _ _ 　 _ _ _ _" }]);
});

test("room settings cap choices and filter and deduplicate custom words", () => {
  const settings = drawSettings({
    seconds: 20, cycles: 99, choices: 5, hints: 0, mode: "mixed",
    customWords: "სახლი, WORD, word, ზღვის  ნაპირი, <script>", customOnly: true,
  }, 80_000);
  assert.deepEqual(settings, {
    duration: 20_000, cycles: 1, choices: 5, hints: 0, mode: "mixed",
    customWords: ["სახლი", "word", "ზღვის ნაპირი"], customOnly: true,
  });
  assert.equal(drawSettings({ seconds: "20", customOnly: true }, 10_000).duration, 10_000);
  assert.equal(drawSettings({ customOnly: true }, 10_000).customOnly, false);
});

test("shapes and fills retain only valid drawing data", () => {
  const action = { type: "ellipse", x1: 25, y1: 50, x2: 640, y2: 480, size: 6, color: "#6699ab", strokeId: 2 };
  assert.deepEqual(sanitizeDrawAction({ ...action, other: "ignored" }), action);
  assert.equal(sanitizeDrawAction({ ...action, x2: 641 }), null);
  assert.equal(sanitizeDrawAction({ ...action, size: NaN }), null);
  assert.equal(sanitizeDrawAction({ ...action, type: "script" }), null);
  assert.equal(sanitizeDrawAction({ ...action, color: "red" }), null);
  assert.equal(sanitizeDrawAction({ ...action, color: { toString: null } }), null);
  const fill = { type: "fill", x: 0, y: 0, color: "#ffffff", strokeId: 3 };
  assert.deepEqual(sanitizeDrawAction(fill), fill);
});

test("near guesses include a missing, extra, swapped, or mistyped letter", () => {
  for (const guess of ["სხლი", "სახალი", "სალხი", "სახმი"]) {
    assert.equal(closeDrawGuess(guess, "სახლი"), true, guess);
  }
  assert.equal(closeDrawGuess("სახლი", "სახლი"), false);
  assert.equal(closeDrawGuess("კარი", "სახლი"), false);
  assert.equal(closeDrawGuess("ცხ", "ხე"), false);
});
