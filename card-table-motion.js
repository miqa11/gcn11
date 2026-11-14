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
    const sameTable = tables.get(root) === tableId;
    tables.set(root, tableId);
    const motion = !matchMedia("(prefers-reduced-motion: reduce)").matches && !!Element.prototype.animate;
    const before = sameTable ? measure(root) : new Map();
    render();
    const after = measure(root);
    const deckRect = deck?.getBoundingClientRect() || root.getBoundingClientRect();
    const origin = center(deckRect);
    const kept = new Set();
    let dealt = 0;
    let flipped = false;
    let moved = false;
    let collected = false;

    for (const [key, current] of after) {
      const { el, rect } = current;
      const previous = before.get(key);
      if (previous && (!previous.el.dataset.tableFace || previous.el.dataset.tableFace === el.dataset.tableFace)) {
        kept.add(key);
        if (previous.el === el) continue;
        const flight = flights.get(previous.el);
        if (!previous.el.dataset.tableFace && el.dataset.tableFace) {
          flipped = true;
          if (motion) {
            const back = ghost(root, previous);
            const turn = (start, end) => [{ transform: start }, { transform: end }];
            const edge = "perspective(550px) rotateY(-90deg)";
            play(back, turn("perspective(550px) rotateY(0deg)", edge), 125).finished.then(() => back.remove(), () => back.remove());
            play(el, turn("perspective(550px) rotateY(90deg)", "perspective(550px) rotateY(0deg)"), 175, 125, rect);
          }
        } else if (motion && flight?.animation.playState === "running" && distance(flight.target, rect) < 1) {
          play(el, flight.frames, flight.duration, flight.delay, rect).currentTime = flight.animation.currentTime;
        } else if (distance(previous.rect, rect) > 1) {
          moved ||= !!el.dataset.tableFrom;
          if (motion) play(el, [
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
      if (motion) play(el, [
        { translate: delta(start, rect), scale: ".66", rotate: (dealt % 2 ? 7 : -7) + "deg", opacity: 0 },
        { opacity: 1, offset: .34 },
        { translate: "0 0", scale: "1", rotate: "0deg", opacity: 1 }
      ], 350, Math.min(220, dealt * 40), rect);
      dealt++;
    }

    for (const [key, previous] of before) {
      if (kept.has(key)) continue;
      const destination = collect ? collect(previous.el, key) : deck;
      if (destination === false) continue;
      collected = true;
      if (!motion) continue;
      const copy = ghost(root, previous);
      const to = destination?.getBoundingClientRect();
      play(copy, [
        { translate: "0 0", scale: "1", opacity: 1 },
        { translate: delta(to?.width ? center(to) : origin, previous.rect), scale: ".6", opacity: 0 }
      ], 280).finished.then(() => copy.remove(), () => copy.remove());
    }
    if (sameTable) {
      if (flipped) window.GaicaniCardSound?.play("flip");
      else if (dealt) window.GaicaniCardSound?.play("deal", dealt);
      else if (collected) window.GaicaniCardSound?.play("collect");
      else if (moved) window.GaicaniCardSound?.play("move");
    }
  }

  window.GaicaniCardMotion = Object.freeze({ mark, animate });
})();
