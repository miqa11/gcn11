(async function () {
  "use strict";

  const adUrl = "https://uplcm.com/4/11150018";
  function openAd() {
    let popup;
    try {
      // Open synchronously during the click. Using a blank page lets us
      // detect a blocked popup before safely navigating to the advertiser.
      popup = window.open("about:blank", "_blank");
      if (!popup) return false;
      popup.opener = null;
      const link = popup.document.createElement("a");
      link.href = adUrl;
      link.rel = "noreferrer";
      link.referrerPolicy = "no-referrer";
      popup.document.body.appendChild(link);
      link.click();
      return true;
    } catch {
      try { popup?.close(); } catch {}
      return false;
    }
  }

  const html = document.documentElement;
  function enableAds() {
    html.dataset.gaicaniAds = "enabled";
    const template = document.getElementById("gaicani-ad-tags");
    for (const source of template.content.querySelectorAll("script")) {
      const script = document.createElement("script");
      for (const { name, value } of source.attributes) script.setAttribute(name, value);
      script.textContent = source.textContent;
      document.head.appendChild(script);
    }
  }

  let liveVip;
  window.GaicaniAds = {
    directUrl: adUrl,
    openDirect: openAd,
    setVip(isVip) {
      const wasVip = liveVip === true || html.hasAttribute("data-gaicani-vip");
      liveVip = !!isVip;
      html.toggleAttribute("data-gaicani-vip", liveVip);
      if (wasVip && !liveVip && !html.dataset.gaicaniAds) enableAds();
    },
  };

  // Keep ads inactive while the server checks a signed-in account.
  try {
    const token = localStorage.getItem("gaicani_auth_token");
    if (token) {
      const response = await fetch("/api/ads/eligibility", {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      });
      if (!response.ok) return;
      const { adsAllowed } = await response.json();
      if (liveVip === true) return;
      if (adsAllowed !== true && liveVip !== false) {
        html.setAttribute("data-gaicani-vip", "");
        return;
      }
    }
  } catch {
    return;
  }

  if (!html.dataset.gaicaniAds) enableAds();
})();
