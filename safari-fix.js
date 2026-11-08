(function () {
  "use strict";

  const root = document.documentElement;
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const viewport = window.visualViewport;
  const editors = 'textarea,[contenteditable]:not([contenteditable="false"]),input:not([type]),input:is([type="text"],[type="password"],[type="search"],[type="email"],[type="tel"],[type="url"],[type="number"])';
  const subscribers = new Set();
  const touch = matchMedia("(any-pointer: coarse)").matches;
  let frame = 0;
  let previous;
  let restingHeight = 0;
  let restingWidth = 0;

  const editing = () => !!document.activeElement?.matches(editors);

  function read() {
    const zoomed = !!viewport && Math.abs(viewport.scale - 1) > .02;
    if (zoomed && previous) return previous;
    const layoutHeight = root.clientHeight || innerHeight;
    const visibleHeight = viewport && !zoomed ? viewport.height : layoutHeight;
    const top = Math.max(0, viewport && !zoomed ? viewport.offsetTop : 0);
    const bottom = Math.max(0, Math.ceil(layoutHeight - top - visibleHeight));
    const height = Math.floor(visibleHeight);
    // Overlay keyboards shrink only the visible viewport. Content-resizing
    // keyboards shrink both viewports, so there is no bottom offset to apply.
    const overlay = layoutHeight - visibleHeight > 2;
    const resized = touch && root.clientWidth === restingWidth && restingHeight - height > 80;
    const keyboard = (editing() || !!previous?.keyboard) && (overlay || resized);
    return { height, keyboard, top: Math.round(top), bottom };
  }

  function update() {
    frame = 0;
    const state = read();
    const width = root.clientWidth;
    if (!restingHeight || width !== restingWidth || (!editing() && !state.keyboard)) {
      restingHeight = state.height;
      restingWidth = width;
    } else if (!state.keyboard) restingHeight = Math.max(restingHeight, state.height);
    if (previous && Object.keys(state).every(key => state[key] === previous[key])) return;
    previous = state;
    root.style.setProperty("--gc-visible-height", state.height + "px");
    root.style.setProperty("--gc-viewport-top", state.top + "px");
    root.style.setProperty("--gc-keyboard-bottom", state.bottom + "px");
    root.classList.toggle("gc-keyboard-open", state.keyboard);
    root.classList.toggle("gc-short-keyboard", state.keyboard && state.height < 240);
    for (const listener of subscribers) listener(state);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  window.GaicaniViewport = {
    read,
    subscribe(listener) {
      subscribers.add(listener);
      listener(read());
    }
  };

  for (const event of ["resize", "pageshow"]) window.addEventListener(event, schedule, { passive: true });
  viewport?.addEventListener("resize", schedule, { passive: true });
  viewport?.addEventListener("scroll", schedule, { passive: true });
  for (const event of ["focusin", "focusout"]) document.addEventListener(event, schedule, { passive: true });
  schedule();

  if (iOS) {
    root.classList.add("is-ios");
    document.addEventListener("touchstart", () => {}, { passive: true });
  }

  const style = document.createElement("style");
  style.id = "safariFixCss";
  style.textContent = `
    html.is-ios { -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; touch-action: manipulation }
    .is-ios :is(${editors}) { font-size: max(16px, 1em) !important }
    @media (hover: none) {
      .is-ios body { cursor: pointer }
      .is-ios :is(input, textarea, [contenteditable]) { cursor: auto }
    }
    .is-ios :is(.top-bar,.chat-input,.fc-header,#fc-input-bar) {
      -webkit-backdrop-filter: none; backdrop-filter: none;
    }
    .gc-keyboard-open dialog[open] {
      position: fixed; top: calc(var(--gc-viewport-top) + 6px); bottom: auto;
      max-height: calc(var(--gc-visible-height) - 12px); overflow-y: auto;
    }
    .gc-keyboard-open #chatPanel.show {
      position: fixed; top: var(--gc-viewport-top); bottom: var(--gc-keyboard-bottom);
      height: auto; max-height: var(--gc-visible-height);
    }
    .gc-keyboard-open #priv-panel {
      bottom: var(--gc-keyboard-bottom);
      height: var(--gc-visible-height);
      max-height: calc(var(--gc-visible-height) - 8px);
    }
    .gc-keyboard-open #priv-messages { min-height: 0; }
    .gc-short-keyboard #priv-panel :is(.pc-header,.pc-input-row,#priv-messages) { padding-block: 5px; }
    .gc-keyboard-open :is(#nameModal,#bioPopup) {
      top: var(--gc-viewport-top); bottom: var(--gc-keyboard-bottom);
    }
    .gc-keyboard-open :is(#nameModal,#bioPopup) > :is(.modal-content,.bio-popup-content) {
      max-height: 100%; overflow-y: auto;
    }
    .is-ios.gc-keyboard-open .chat-input-row { padding-bottom: 7px }
  `;
  document.head.append(style);
  if (!iOS) return;

  // On locked full-screen pages, clear WebKit's residual document scroll
  // once the keyboard closes. Leave editable overlays and pinch zoom alone.
  function resetScroll() {
    if (!document.body || !scrollY || (viewport && Math.abs(viewport.scale - 1) > .02)) return;
    if (editing()) return;
    const locked = getComputedStyle(document.body).overflowY === "hidden" || getComputedStyle(root).overflowY === "hidden";
    if (locked && root.scrollHeight <= innerHeight + 2) scrollTo(0, 0);
  }
  window.GaicaniViewport.subscribe(state => { if (!state.keyboard) requestAnimationFrame(resetScroll); });
  document.addEventListener("focusout", () => setTimeout(resetScroll, 150), { passive: true });
})();
