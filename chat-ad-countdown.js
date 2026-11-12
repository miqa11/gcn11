(function () {
  "use strict";

  const limits = { search: 3, block: 3, private: 5 };
  const remaining = {};
  const blocked = {};

  function storageKey(kind) {
    return "gaicani_ad_countdown_" + kind;
  }

  function render(kind) {
    for (const badge of document.querySelectorAll('[data-chat-ad-counter="' + kind + '"]')) {
      const compact = badge.classList.contains("chat-ad-button-count");
      badge.textContent = compact ? String(remaining[kind]) : "რეკლამამდე · " + remaining[kind];
      if (compact) badge.setAttribute("aria-label", "რეკლამამდე " + remaining[kind] + " დაჭერა");
      if (blocked[kind]) {
        const link = document.createElement("a");
        link.className = "chat-ad-open";
        link.href = window.GaicaniAds.directUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.referrerPolicy = "no-referrer";
        link.textContent = compact ? "↗" : "გახსენი რეკლამა ↗";
        link.setAttribute("aria-label", "გახსენი რეკლამა");
        link.title = "გახსენი რეკლამა";
        badge.append(" · ", link);
      }
    }
  }

  for (const [kind, limit] of Object.entries(limits)) {
    let stored;
    try { stored = Number(sessionStorage.getItem(storageKey(kind))); } catch {}
    remaining[kind] = Number.isInteger(stored) && stored > 0 && stored <= limit ? stored : limit;
    render(kind);
  }

  window.GaicaniChatAds = {
    count(kind) {
      if (document.documentElement.dataset.gaicaniAds !== "enabled" || window.gaicaniAuthUser?.isPro) return;
      if (!Object.hasOwn(limits, kind)) return;
      remaining[kind]--;
      const showAd = remaining[kind] === 0;
      if (showAd) remaining[kind] = limits[kind];
      try { sessionStorage.setItem(storageKey(kind), String(remaining[kind])); } catch {}
      // Called directly by the user's click or send key, so browsers can
      // open the new tab without delaying the chat action.
      if (showAd) blocked[kind] = !window.GaicaniAds.openDirect();
      render(kind);
    },
  };
})();
