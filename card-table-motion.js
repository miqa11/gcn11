(function () {
  "use strict";

  const selector = "[data-table-card]";
  const tables = new WeakMap();
  const flights = new WeakMap();
  const easing = "cubic-bezier(.2,.75,.28,1)";

  function mark(el, key, face, from) {
    el.dataset.tableCard = key;
    el.dataset.tableFace = face || "";
    if (from) el.dataset.tableFrom = from;
    return el;
  }

  function measure(root) {
    const cards = new Map();
    for (const el of root.querySelectorAll(selector)) {
      const rect = el.getBoundingClientRect();
      if (rect.width && rect.height) cards.set(el.dataset.tableCard, { el, rect });
    }
    return cards;
  }

  const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  function delta(from, rect) {
    const to = center(rect);
    return `${from.x - to.x}px ${from.y - to.y}px`;
  }

  function ghost(root, { el, rect }) {
    const copy = el.cloneNode(true);
    copy.removeAttribute("data-table-card");
    copy.removeAttribute("data-card");
    copy.removeAttribute("id");
    copy.setAttribute("aria-hidden", "true");
    copy.inert = true;
    Object.assign(copy.style, {
      position: "fixed", inset: "auto", margin: "0", transform: "none",
      left: rect.left + "px", top: rect.top + "px", width: rect.width + "px", height: rect.height + "px",
      zIndex: "12", pointerEvents: "none", opacity: "1", boxSizing: "border-box", transition: "none"
    });
    root.append(copy);
    return copy;
  }

  function play(el, frames, duration, delay = 0, target = null) {
    const animation = el.animate(frames, { duration, delay, easing, fill: "backwards" });
    if (target) flights.set(el, { animation, frames, duration, delay, target });
    return animation;
  }

  const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) +
    Math.abs(a.width - b.width) + Math.abs(a.height - b.height);

  function animate(root, tableId, render, { deck, collect } = {}) {
    const previousTable = tables.get(root);
    tables.set(root, tableId);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !Element.prototype.animate) return render();
    const before = previousTable === tableId ? measure(root) : new Map();
    render();
    const after = measure(root);
    const deckRect = deck?.getBoundingClientRect() || root.getBoundingClientRect();
    const origin = center(deckRect);
    const kept = new Set();
    let dealt = 0;

    for (const [key, current] of after) {
      const { el, rect } = current;
      const previous = before.get(key);
      if (previous && (!previous.el.dataset.tableFace || previous.el.dataset.tableFace === el.dataset.tableFace)) {
        kept.add(key);
        if (previous.el === el) continue;
        const flight = flights.get(previous.el);
        if (!previous.el.dataset.tableFace && el.dataset.tableFace) {
          const back = ghost(root, previous);
          play(back, [{ scale: "1 1" }, { scale: "0 1" }], 135).finished.then(() => back.remove(), () => back.remove());
          play(el, [{ scale: "0 1" }, { scale: "1 1" }], 165, 135, rect);
        } else if (flight?.animation.playState === "running" && distance(flight.target, rect) < 1) {
          play(el, flight.frames, flight.duration, flight.delay, rect).currentTime = flight.animation.currentTime;
        } else if (distance(previous.rect, rect) > 1) {
          play(el, [
            { translate: delta(center(previous.rect), rect), scale: `${previous.rect.width / rect.width} ${previous.rect.height / rect.height}` },
            { translate: "0 0", scale: "1" }
          ], 270, 0, rect);
        }
        continue;
      }
      const source = el.dataset.tableFrom;
      const sourceRect = source ? root.querySelector(source)?.getBoundingClientRect() : null;
      const start = sourceRect?.width ? center(sourceRect) : { ...origin };
      const target = center(rect);
      if (Math.hypot(start.x - target.x, start.y - target.y) < 7) {
        start.x -= 18; start.y -= 24;
      }
      play(el, [
        { translate: delta(start, rect), scale: ".68", opacity: 0 },
        { opacity: 1, offset: .36 },
        { translate: "0 0", scale: "1", opacity: 1 }
      ], 320, Math.min(240, dealt++ * 36), rect);
    }

    for (const [key, previous] of before) {
      if (kept.has(key)) continue;
      const destination = collect ? collect(previous.el, key) : deck;
      if (destination === false) continue;
      const copy = ghost(root, previous);
      const to = destination?.getBoundingClientRect();
      play(copy, [
        { translate: "0 0", scale: "1", opacity: 1 },
        { translate: delta(to?.width ? center(to) : origin, previous.rect), scale: ".6", opacity: 0 }
      ], 280).finished.then(() => copy.remove(), () => copy.remove());
    }
  }

  window.GaicaniCardMotion = Object.freeze({ mark, animate });
})();
