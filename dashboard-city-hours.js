(() => {
  "use strict";

  const card = document.getElementById("cityNavCard");
  const label = document.getElementById("cityNavStatus");
  let refreshTimer;
  let pending = false;

  function showHours(open) {
    if (open) {
      card.href = "/city.html";
      card.removeAttribute("aria-disabled");
    } else {
      card.removeAttribute("href");
      card.setAttribute("aria-disabled", "true");
    }
    label.textContent = open === true ? "ღიაა 05:00-მდე"
      : open === false ? "დაკეტილია · გაიხსნება 21:00-ზე"
      : "სამუშაო საათები · 21:00–05:00";
  }

  async function refresh() {
    if (pending) return;
    pending = true;
    clearTimeout(refreshTimer);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let delay = 30_000;
    try {
      const response = await fetch("/api/city/hours", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error();
      const { open, msUntilChange } = await response.json();
      if (typeof open !== "boolean" || !Number.isFinite(msUntilChange) || msUntilChange <= 0) throw new Error();
      showHours(open);
      delay = msUntilChange;
    } catch {
      showHours(null);
    } finally {
      pending = false;
      clearTimeout(timeout);
      refreshTimer = setTimeout(() => {
        showHours(null);
        refresh();
      }, delay);
    }
  }

  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
})();
