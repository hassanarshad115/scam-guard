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
      ? result.reasons
      : ["This website follows known scam patterns."];

    const box = document.createElement("div");
    box.id = "scamguard-overlay";
    box.setAttribute("role", "alertdialog");
    box.setAttribute("aria-label", "Warning: fake website");

    const inner = document.createElement("div");
    inner.id = "scamguard-box";

    const shield = document.createElement("div");
    shield.id = "scamguard-shield";
    shield.textContent = "\uD83D\uDEE1";

    const heading = document.createElement("h1");
    heading.textContent = "Warning: Fake Website!";

    const host = document.createElement("div");
    host.id = "scamguard-host";
    host.textContent = result.hostname || currentUrl;

    const list = document.createElement("ul");
    for (const reason of reasons) {
      const li = document.createElement("li");
      li.textContent = reason;
      list.appendChild(li);
    }

    const actions = document.createElement("div");
    actions.id = "scamguard-actions";

    const backBtn = document.createElement("button");
    backBtn.id = "scamguard-back";
    backBtn.type = "button";
    backBtn.textContent = "Go Back - Don\u2019t Enter Anything";

    const continueBtn = document.createElement("button");
    continueBtn.id = "scamguard-continue";
    continueBtn.type = "button";
    continueBtn.textContent = "I trust this site, continue anyway";

    actions.appendChild(backBtn);
    actions.appendChild(continueBtn);

    const hint = document.createElement("div");
    hint.id = "scamguard-hint";
    hint.textContent = "Scam Guard warning: if this site uses the name of a real brand such as a bank, PayPal or Google, " +
      "do not enter your password or card details here.";

    inner.appendChild(shield);
    inner.appendChild(heading);
    inner.appendChild(host);
    inner.appendChild(list);
    inner.appendChild(actions);
    inner.appendChild(hint);
    box.appendChild(inner);

    (document.documentElement || document.body || document).appendChild(box);

    backBtn.addEventListener("click", () => {
      try { history.back(); } catch (e) { /* noop */ }
      try { window.close(); } catch (e) { /* noop */ }
    });
    continueBtn.addEventListener("click", () => {
      try { box.remove(); } catch (e) { box.style.display = "none"; }
    });
  }
})();
