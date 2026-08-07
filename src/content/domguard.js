// Scam Guard - live page guards (runs at document_idle)
// Hover tooltip, login-form cross-origin check, HTTP-password warning,
// and paste protection on suspicious pages. All local, nothing is sent anywhere.

(function () {
  "use strict";

  const ownOrigin = chrome.runtime.getURL("");
  if (window.location.href.indexOf(ownOrigin) === 0 || window.location.href.indexOf("about:") === 0) return;

  let pageVerdict = null;
  let mismatchWarned = false;
  let httpWarned = false;
  let pasteArmed = false;
  let allowPasteOnce = false;
  let formScanTimer = null;

  // ---- page verdict (background answers instantly from its cache) ----
  chrome.runtime.sendMessage({ type: "analyze", url: window.location.href }, (result) => {
    if (!chrome.runtime.lastError && result) {
      pageVerdict = result.verdict;
      if (result.verdict === "danger" || result.verdict === "caution") armPasteGuard();
    }
  });

  // ---- hover tooltip: verdict on any link ----
  const tooltipCache = new Map();
  let tooltipEl = null;
  let hideTimer = null;

  document.addEventListener("mouseover", (e) => {
    const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    const href = a.href || "";
    if (href.indexOf("http://") !== 0 && href.indexOf("https://") !== 0) return;

    if (tooltipCache.has(href)) {
      showTooltip(e, tooltipCache.get(href));
      return;
    }
    if (tooltipCache.size > 200) {
      const first = tooltipCache.keys().next().value;
      if (first !== undefined) tooltipCache.delete(first);
    }
    chrome.runtime.sendMessage({ type: "analyze", url: href }, (result) => {
      if (chrome.runtime.lastError || !result) return;
      tooltipCache.set(href, result.verdict);
      showTooltip(e, result.verdict);
    });
  }, true);

  function showTooltip(e, verdict) {
    if (verdict !== "danger" && verdict !== "caution") return;
    clearTimeout(hideTimer);
    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.id = "scamguard-tooltip";
      tooltipEl.setAttribute("role", "tooltip");
      (document.documentElement || document.body || document).appendChild(tooltipEl);
    }
    const danger = verdict === "danger";
    tooltipEl.textContent =
      (danger ? "\u26D4 " : "\u26A0\uFE0F ") +
      (danger ? "Scam Guard: likely fake site" : "Scam Guard: looks suspicious");
    tooltipEl.className = danger ? "sg-tooltip sg-tooltip-danger" : "sg-tooltip sg-tooltip-caution";
    tooltipEl.style.left = Math.max(8, e.clientX + 14) + "px";
    tooltipEl.style.top = Math.max(8, e.clientY + 14) + "px";
    tooltipEl.style.display = "block";
  }

  document.addEventListener("mouseout", () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (tooltipEl) tooltipEl.style.display = "none";
    }, 150);
  }, true);

  // ---- sensitive fields ----
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

  function armPasteGuard() {
    if (pasteArmed) return;
    pasteArmed = true;
    document.addEventListener("paste", (e) => {
      if (allowPasteOnce) { allowPasteOnce = false; return; }
      const el = e.target;
      if (!isSensitiveField(el)) return;
      const pageBad = pageVerdict === "danger" || pageVerdict === "caution" || mismatchWarned || httpWarned;
      if (!pageBad) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      showPasteGuard(el);
    }, true);
  }

  function showPasteGuard(el) {
    let chip = document.getElementById("scamguard-paste-guard");
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "scamguard-paste-guard";
      chip.setAttribute("role", "alert");
      const text = document.createElement("span");
      text.textContent = "Scam Guard blocked the paste - this page looks suspicious.";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Paste anyway";
      btn.addEventListener("click", () => {
        allowPasteOnce = true;
        chip.style.display = "none";
      });
      chip.appendChild(text);
      chip.appendChild(btn);
      (document.documentElement || document.body || document).appendChild(chip);
    }
    try {
      const r = el.getBoundingClientRect();
      chip.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 360)) + "px";
      chip.style.top = Math.max(8, r.bottom + 6) + "px";
    } catch (err) {
      chip.style.left = "12px";
      chip.style.top = "12px";
    }
    chip.style.display = "flex";
  }

  // ---- login form checks ----
  function scanForms() {
    if (document.readyState === "loading") return;
    const forms = document.querySelectorAll("form");
    for (const form of forms) {
      if (form.getAttribute("data-sg-checked") === "1") continue;
      form.setAttribute("data-sg-checked", "1");
      const pwd = form.querySelector("input[type=password]");
      if (!pwd) continue;

      // 1. form action sends the password to a DIFFERENT domain
      let action = "";
      try { action = form.action || ""; } catch (err) { action = ""; }
      if (action) {
        try {
          const actionUrl = new URL(action, window.location.href);
          if (actionUrl.origin !== window.location.origin) {
            mismatchWarned = true;
            showFormWarn(form,
              "This login form sends your password to " + actionUrl.hostname +
              " - but this page is " + window.location.hostname +
              ". Real login pages never send passwords to another domain.");
            armPasteGuard();
            continue;
          }
        } catch (err) { /* unparseable action, ignore */ }
      }

      // 2. password entered over plain HTTP
      if (window.location.protocol === "http:") {
        httpWarned = true;
        showFormWarn(form,
          "This page is not encrypted (HTTP). Anything you type here can be read by others on the network.");
        armPasteGuard();
      }
    }
  }

  function showFormWarn(form, message) {
    if (form.getAttribute("data-sg-formwarn") === "1") return;
    form.setAttribute("data-sg-formwarn", "1");

    const banner = document.createElement("div");
    banner.className = "sg-form-warn";
    banner.setAttribute("role", "alert");
    const text = document.createElement("span");
    text.textContent = "\u26A0\uFE0F " + message;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Dismiss warning");
    closeBtn.textContent = "\u2715";
    closeBtn.addEventListener("click", () => { try { banner.remove(); } catch (err) { banner.style.display = "none"; } });
    banner.appendChild(text);
    banner.appendChild(closeBtn);
    try {
      form.parentNode.insertBefore(banner, form);
    } catch (err) { /* noop */ }
  }

  // run now, then watch for late-added login forms
  scanForms();
  setTimeout(scanForms, 1200);

  if (typeof MutationObserver === "function") {
    const mo = new MutationObserver(() => {
      if (formScanTimer) return;
      formScanTimer = setTimeout(() => {
        formScanTimer = null;
        scanForms();
      }, 800);
    });
    try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (err) { /* noop */ }
  }
})();
