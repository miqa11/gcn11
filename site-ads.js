(async function () {
  "use strict";

  // Keep ads inactive while the server checks a signed-in account.
  try {
    const token = localStorage.getItem("gaicani_auth_token");
    if (token) {
      const response = await fetch("/api/ads/eligibility", {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      });
      if (!response.ok || (await response.json()).adsAllowed !== true) return;
    }
  } catch {
    return;
  }

  document.documentElement.dataset.gaicaniAds = "enabled";
  const template = document.getElementById("gaicani-ad-tags");
  for (const source of template.content.querySelectorAll("script")) {
    const script = document.createElement("script");
    for (const { name, value } of source.attributes) script.setAttribute(name, value);
    script.textContent = source.textContent;
    document.head.appendChild(script);
  }
})();
