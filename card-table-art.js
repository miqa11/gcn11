/* Presentation only. Card identities, legal moves and game state remain with each game. */
(function () {
  "use strict";
  const suits = { h: ["♥", "გული"], d: ["♦", "აგური"], s: ["♠", "ყვავი"], c: ["♣", "ჯვარი"] };
  const ranks = { A: "ტუზი", T: "ათი", J: "ვალეტი", Q: "დედოფალი", K: "მეფე" };
  const cache = new Map();
  const layouts = {
    2: [[50, 27], [50, 113]],
    3: [[50, 27], [50, 70], [50, 113]],
    4: [[32, 29], [68, 29], [32, 111], [68, 111]],
    5: [[32, 29], [68, 29], [50, 70], [32, 111], [68, 111]],
    6: [[32, 29], [68, 29], [32, 70], [68, 70], [32, 111], [68, 111]],
    7: [[32, 29], [68, 29], [50, 49], [32, 70], [68, 70], [32, 111], [68, 111]],
    8: [[32, 29], [68, 29], [50, 49], [32, 70], [68, 70], [50, 91], [32, 111], [68, 111]],
    9: [[32, 27], [68, 27], [32, 56], [68, 56], [50, 70], [32, 84], [68, 84], [32, 113], [68, 113]],
    T: [[32, 27], [68, 27], [50, 42], [32, 56], [68, 56], [32, 84], [68, 84], [50, 98], [32, 113], [68, 113]]
  };
  function pip(glyph, x, y, size) {
    return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central"${y > 70 ? ` transform="rotate(180 ${x} ${y})"` : ""}>${glyph}</text>`;
  }
  function court(rank, color, glyph) {
    // A mirrored, engraved court illustration, with a different crown and staff for each rank.
    const crown = rank === "J" ? "M33 39V31L55 35V40" : rank === "Q" ? "M32 39L29 27L37 31L43 23L49 31L57 27L54 39" : "M31 39L27 24L37 30L43 20L49 30L59 24L55 39";
    const half = `<path d="M23 72L27 57L37 51H52L64 61L74 72" fill="${color}"/><path d="M26 70L38 55L48 68L58 55L70 70" fill="#d1aa5b"/><path d="M38 52L37 40Q43 34 53 40L54 48L48 55Z" fill="#edcfab" stroke="#584133" stroke-width="1"/><path d="M35 41Q35 31 49 33L55 39L46 38L44 44Z" fill="#2b3542"/><path d="${crown}" fill="#d4ab54" stroke="#74542e" stroke-width="1"/><path d="M47 43H50M52 46H55M47 50Q50 52 53 50" fill="none" stroke="#584133" stroke-width="1"/><path d="M63 34V68M60 39L63 29L66 39Z" fill="#d4ab54" stroke="#74542e" stroke-width="1"/><path d="M28 58L61 72M36 57L65 69" stroke="#f0d58c" stroke-width="1.3"/><text x="29" y="47" font-size="14" fill="${color}">${glyph}</text>`;
    return `<rect x="23" y="20" width="54" height="100" rx="2" fill="#f4e7cb" stroke="#c6a163" stroke-width="1"/><g>${half}</g><g transform="rotate(180 50 70)">${half}</g><path d="M24 70H76" stroke="#c6a163" stroke-width="1"/>`;
  }
  function art(card) {
    if (cache.has(card)) return cache.get(card);
    const joker = card === "JK1" || card === "JK2";
    if (!joker && !/^[A2-9TJQK][hdsc]$/.test(card || "")) return null;
    const rank = joker ? "★" : card[0] === "T" ? "10" : card[0];
    const glyph = joker ? "✦" : suits[card[1]][0];
    const color = joker ? (card === "JK1" ? "#89312e" : "#263f58") : /[hd]/.test(card[1]) ? "#ad292f" : "#1b2936";
    const corner = `<text x="12" y="20" font-size="20" font-weight="700" text-anchor="middle">${rank}</text><text x="12" y="36" font-size="18" text-anchor="middle">${glyph}</text>`;
    let center;
    if (joker) {
      center = `<path d="M26 62Q21 35 36 35L46 49Q48 20 60 28L60 47Q79 34 76 60L67 57L60 69H39L33 57Z" fill="${color}" stroke="#b38b47" stroke-width="1.5"/><path d="M36 62Q50 52 64 62L61 82L50 91L39 82Z" fill="#edcfab" stroke="#876548"/><path d="M40 69L46 72M54 72L60 69M44 80Q50 85 57 79" fill="none" stroke="${color}" stroke-width="2"/><path d="M31 99L40 85L50 96L60 85L70 99L61 113H39Z" fill="${color}" stroke="#b38b47"/><path d="M38 98L50 107L62 98M50 96V112" fill="none" stroke="#e5bf70" stroke-width="2"/><g fill="#d5b372"><circle cx="27" cy="61" r="3"/><circle cx="49" cy="29" r="3"/><circle cx="76" cy="59" r="3"/></g>`;
    } else if (/[JQK]/.test(card[0])) center = court(card[0], color, glyph);
    else if (card[0] === "A") center = `${pip(glyph, 50, 70, 58)}<path d="M35 110H65" stroke="#cbb887"/><text x="50" y="122" fill="#9e875a" font-family="Georgia,serif" font-size="7" text-anchor="middle">◆</text>`;
    else center = layouts[card[0]].map(([x, y]) => pip(glyph, x, y, card[0] === "T" || card[0] === "9" ? 19 : 23)).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="gc-deck-face" viewBox="0 0 100 140" aria-hidden="true" focusable="false"><rect x=".6" y=".6" width="98.8" height="138.8" rx="7" fill="#fffdf5" stroke="#cdbd9f"/><path d="M5 65V9a4 4 0 0 1 4-4h56M95 75v56a4 4 0 0 1-4 4H35" stroke="#dac5a2" fill="none"/><path d="M72 5h19a4 4 0 0 1 4 4v19M28 135H9a4 4 0 0 1-4-4v-19" stroke="#eadbc0" fill="none"/><g fill="${color}" font-family="Georgia, 'Times New Roman', serif">${corner}<g transform="rotate(180 50 70)">${corner}</g>${center}</g></svg>`;
    cache.set(card, svg);
    return svg;
  }
  window.GaicaniCardArt = Object.freeze({
    paint(el, card) {
      const svg = art(card);
      if (!svg) return;
      el.innerHTML = svg;
      el.classList.add("gc-deck-card");
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", card.startsWith("JK") ? "ჯოკერი" : `${ranks[card[0]] || card[0]} ${suits[card[1]][1]}`);
    }
  });
})();
