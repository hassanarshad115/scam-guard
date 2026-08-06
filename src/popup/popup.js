// Scam Guard - popup logic

(function () {
  "use strict";

  const ICONS = { safe: "\u2705", caution: "\u26A0\uFE0F", danger: "\u274C", loading: "\u231B" };
  const TEXTS = {
    safe: "This site looks safe.",
    caution: "Caution: this site looks suspicious.",
    danger: "DANGER: this may be a fake website!",
    loading: "Checking this site..."
  };

  const statusEl = document.getElementById("sg-status");
  const iconEl = document.getElementById("sg-status-icon");
  const textEl = document.getElementById("sg-status-text");
  const hostEl = document.getElementById("sg-host");
  const reasonsEl = document.getElementById("sg-reasons");
  const blockBtn = document.getElementById("sg-block");
  const allowBtn = document.getElementById("sg-allow");
  const statsEl = document.getElementById("sg-stats");
  const optionsBtn = document.getElementById("sg-options");
  const moreLink = document.getElementById("sg-more");

  function setStatus(verdict) {
    statusEl.className = "sg-status " + (ICONS[verdict] ? verdict : "loading");
    iconEl.textContent = ICONS[verdict] || ICONS.loading;
    textEl.textContent = TEXTS[verdict] || TEXTS.loading;
  }

  function safeHost(url) {
    try { return new URL(url).hostname; } catch (e) { return ""; }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    const url = tab ? tab.url : "";
    const host = safeHost(url);
    hostEl.textContent = host;

    if (!url || (url.indexOf("http://") !== 0 && url.indexOf("https://") !== 0)) {
      setStatus("safe");
      textEl.textContent = "This is a browser page - nothing to check.";
      return;
    }

    chrome.runtime.sendMessage({ type: "analyze", url: url }, (result) => {
      if (chrome.runtime.lastError || !result) {
        setStatus("safe");
        textEl.textContent = "Could not check this site.";
        return;
      }
      setStatus(result.verdict);

      if (result.reasons && result.reasons.length) {
        reasonsEl.innerHTML = result.reasons.map(r => "<li>" + escapeHtml(r) + "</li>").join("");
        reasonsEl.hidden = false;
      }

      allowBtn.hidden = false;
      if (result.verdict !== "safe") blockBtn.hidden = false;
    });
  });

  blockBtn.addEventListener("click", () => {
    const host = hostEl.textContent;
    if (!host) return;
    chrome.runtime.sendMessage({ type: "blocklist:add", value: host }, () => {
      blockBtn.disabled = true;
      blockBtn.textContent = "Blocked";
      setStatus("danger");
      textEl.textContent = "This site is now always blocked.";
    });
  });

  allowBtn.addEventListener("click", () => {
    const host = hostEl.textContent;
    if (!host) return;
    chrome.runtime.sendMessage({ type: "blocklist:addAllowed", value: host }, () => {
      allowBtn.disabled = true;
      allowBtn.textContent = "Trusted";
      setStatus("safe");
      textEl.textContent = "This site has been added to your trusted list.";
    });
  });

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  optionsBtn.addEventListener("click", openOptions);
  moreLink.addEventListener("click", (e) => { e.preventDefault(); openOptions(); });

  chrome.runtime.sendMessage({ type: "stats:get" }, (stats) => {
    if (stats) {
      statsEl.textContent = "Checked: " + (stats.total || 0) + "  |  Warnings: " + (stats.danger || 0);
    }
  });
})();
