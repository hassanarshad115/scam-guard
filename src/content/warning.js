// Scam Guard - content script (runs at document_start)
// Shows a full-screen warning, a corner toast, or an inline password-field guard.

(function () {
  "use strict";

  const currentUrl = window.location.href;
  const ownOrigin = chrome.runtime.getURL("");

  // never warn on our own pages or special pages
  if (currentUrl.indexOf(ownOrigin) === 0 || currentUrl.indexOf("about:") === 0) return;

  let overlayShown = false;
  let toastShown = false;
  let guardActive = false;

  chrome.storage.local.get({ settings: { enableWarningOverlay: true } }, (data) => {
    const settings = data.settings || {};
    const mode = settings.warningMode || (settings.enableWarningOverlay === false ? "off" : "full");
    if (mode === "off") return;

    chrome.runtime.sendMessage({ type: "analyze", url: currentUrl }, (result) => {
      if (chrome.runtime.lastError || !result) return;
      const verdict = result.verdict;
      if (verdict === "safe") return;

      if (verdict === "danger") {
        if (mode === "full") {
          overlayShown = true;
          showOverlay(result);
        } else {
          showToast(result, "danger");
        }
      } else if (verdict === "caution" && settings.showCaution) {
        showToast(result, "caution");
      }

      if (verdict === "danger" || (verdict === "caution" && settings.showCaution)) {
        enablePasswordGuard();
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

  function showToast(result, level) {
    if (toastShown) return;
    toastShown = true;

    const reasons = (result.reasons && result.reasons.length)
      ? result.reasons
      : ["This website follows known scam patterns."];

    const toast = document.createElement("div");
    toast.id = "scamguard-toast";
    toast.setAttribute("role", "alert");

    const head = document.createElement("div");
    head.id = "scamguard-toast-head";
    const title = document.createElement("strong");
    title.textContent = level === "danger" ? "Warning: Fake Website!" : "Caution: suspicious site";
    head.appendChild(title);

    const host = document.createElement("div");
    host.id = "scamguard-toast-host";
    host.textContent = result.hostname || currentUrl;

    const list = document.createElement("ul");
    for (const r of reasons.slice(0, 2)) {
      const li = document.createElement("li");
      li.textContent = r;
      list.appendChild(li);
    }

    const actions = document.createElement("div");
    actions.id = "scamguard-toast-actions";
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.textContent = "Go back";
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.textContent = "I understand";
    actions.appendChild(backBtn);
    actions.appendChild(okBtn);

    toast.appendChild(head);
    toast.appendChild(host);
    toast.appendChild(list);
    toast.appendChild(actions);

    (document.documentElement || document.body || document).appendChild(toast);

    if (level !== "danger") {
      toast.style.borderColor = "#ffd60a";
      toast.style.borderLeftColor = "#ffd60a";
      head.style.color = "#ffd60a";
    }

    backBtn.addEventListener("click", () => {
      try { history.back(); } catch (e) { /* noop */ }
      try { window.close(); } catch (e) { /* noop */ }
    });
    okBtn.addEventListener("click", () => {
      try { toast.remove(); } catch (e) { toast.style.display = "none"; }
    });
    setTimeout(() => {
      try { toast.remove(); } catch (e) { toast.style.display = "none"; }
    }, 30000);
  }

  function isSensitiveField(el) {
    if (!el || el.nodeType !== 1) return false;
    const type = (el.type || "").toLowerCase();
    if (type === "password") return true;
    if (type !== "text" && type !== "email" && type !== "tel" && type !== "number" && type !== "search") return false;
    const name = (el.name || "").toLowerCase();
    const autocomplete = (el.autocomplete || "").toLowerCase();
    return /pass|pin|otp|one.?time|card|cc|cvv|ssn|secret|billing/i.test(name) ||
      /pass|otp|one.?time|cc|cvv/.test(autocomplete);
  }

  // Inline guard: warns right next to a password field on a suspicious page,
  // even if the user clicked through the full-screen warning.
  function enablePasswordGuard() {
    if (guardActive) return;
    guardActive = true;
    document.addEventListener("focusin", (e) => {
      const el = e.target;
      if (!isSensitiveField(el)) return;
      if (el.getAttribute("data-sg-guarded") === "1") return;
      el.setAttribute("data-sg-guarded", "1");

      const strip = document.createElement("div");
      strip.id = "scamguard-field-guard";
      strip.setAttribute("role", "alert");

      const text = document.createElement("span");
      text.textContent = "Scam Guard: this page looks suspicious - do not enter your password or card details here.";

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.setAttribute("aria-label", "Dismiss warning");
      closeBtn.textContent = "\u2715";
      closeBtn.addEventListener("click", () => {
        try { strip.remove(); } catch (err) { strip.style.display = "none"; }
      });

      strip.appendChild(text);
      strip.appendChild(closeBtn);
      try {
        el.parentNode.insertBefore(strip, el);
      } catch (err) { /* noop */ }
    }, true);
  }
})();
