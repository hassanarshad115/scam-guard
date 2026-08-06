// Scam Guard - content script (runs at document_start, injects warning overlay)

(function () {
  "use strict";

  const currentUrl = window.location.href;
  const ownOrigin = chrome.runtime.getURL("");

  // never warn on our own pages or special pages
  if (currentUrl.indexOf(ownOrigin) === 0 || currentUrl.indexOf("about:") === 0) return;

  let warned = false;

  chrome.storage.local.get({ settings: { enableWarningOverlay: true } }, (data) => {
    const settings = data.settings || {};
    if (settings.enableWarningOverlay === false) return;

    chrome.runtime.sendMessage({ type: "analyze", url: currentUrl }, (result) => {
      if (chrome.runtime.lastError || !result) return;
      if (result.verdict === "danger" && !warned) {
        warned = true;
        showOverlay(result);
      }
    });
  });

  function showOverlay(result) {
    try {
      const existing = document.getElementById("scamguard-overlay");
      if (existing) existing.remove();
    } catch (e) { /* document not ready yet */ }

    const reasons = (result.reasons && result.reasons.length)
      ? result.reasons.map(r => "<li>" + escapeHtml(r) + "</li>").join("")
      : "<li>This website follows known scam patterns.</li>";

    const box = document.createElement("div");
    box.id = "scamguard-overlay";
    box.setAttribute("role", "alertdialog");
    box.setAttribute("aria-label", "Warning: fake website");

    box.innerHTML =
      '<div id="scamguard-box">' +
        '<div id="scamguard-shield">&#128737;</div>' +
        '<h1>Warning: Fake Website!</h1>' +
        '<div id="scamguard-host">' + escapeHtml(result.hostname || currentUrl) + '</div>' +
        '<ul>' + reasons + '</ul>' +
        '<div id="scamguard-actions">' +
          '<button id="scamguard-back" type="button">Go Back - Don\u2019t Enter Anything</button>' +
          '<button id="scamguard-continue" type="button">I trust this site, continue anyway</button>' +
        '</div>' +
        '<div id="scamguard-hint">Scam Guard warning: if this site uses the name of a real brand such as a bank, PayPal or Google, ' +
        'do not enter your password or card details here.</div>' +
      '</div>';

    (document.documentElement || document.body || document).appendChild(box);

    const backBtn = document.getElementById("scamguard-back");
    const continueBtn = document.getElementById("scamguard-continue");

    if (backBtn) {
      backBtn.addEventListener("click", () => {
        try { history.back(); } catch (e) { /* noop */ }
        try { window.close(); } catch (e) { /* noop */ }
      });
    }
    if (continueBtn) {
      continueBtn.addEventListener("click", () => {
        try { box.remove(); } catch (e) { box.style.display = "none"; }
      });
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
