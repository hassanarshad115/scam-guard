// Scam Guard - options page logic

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const heuristicsEl = $("set-heuristics");
  const overlayEl = $("set-overlay");
  const cautionEl = $("set-caution");
  const livefeedEl = $("set-livefeed");
  const toastsEl = $("set-toasts");
  const sensitivityEl = $("set-sensitivity");
  const blockedEl = $("blocked-list");
  const allowedEl = $("allowed-list");
  const blockedMsg = $("blocked-msg");
  const allowedMsg = $("allowed-msg");
  const dataMsg = $("data-msg");
  const statsText = $("stats-text");
  const exportBtn = $("export-list");
  const importBtn = $("import-list");
  const importFile = $("import-file");
  const resetStatsBtn = $("reset-stats");

  function send(type, value) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: type, value: value }, (resp) => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(resp);
      });
    });
  }

  function splitDomains(text) {
    return text
      .split(/[\n,]/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s && s.indexOf(" ") === -1);
  }

  function showMsg(el, text, isError) {
    el.textContent = text;
    el.className = "sg-msg" + (isError ? " error" : "");
    setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 2500);
  }

  async function loadAll() {
    const settings = await send("settings:get");
    if (settings) {
      heuristicsEl.checked = settings.enableHeuristics !== false;
      overlayEl.checked = settings.enableWarningOverlay !== false;
      cautionEl.checked = settings.showCaution === true;
      livefeedEl.checked = settings.enableLiveFeed !== false;
      toastsEl.checked = settings.enableToasts !== false;
      sensitivityEl.value = settings.sensitivity || "medium";
    }

    const blocklist = await send("blocklist:get");
    if (blocklist) {
      blockedEl.value = blocklist.blocked.join("\n");
      allowedEl.value = blocklist.allowed.join("\n");
    }

    const stats = await send("stats:get");
    if (stats) {
      statsText.textContent = "Sites checked: " + (stats.total || 0) +
        "  |  Fake warnings: " + (stats.danger || 0);
    }
  }

  heuristicsEl.addEventListener("change", () => {
    send("settings:set", { enableHeuristics: heuristicsEl.checked });
  });

  overlayEl.addEventListener("change", () => {
    send("settings:set", { enableWarningOverlay: overlayEl.checked });
  });

  cautionEl.addEventListener("change", () => {
    send("settings:set", { showCaution: cautionEl.checked });
  });

  livefeedEl.addEventListener("change", () => {
    send("settings:set", { enableLiveFeed: livefeedEl.checked });
  });

  toastsEl.addEventListener("change", () => {
    send("settings:set", { enableToasts: toastsEl.checked });
  });

  sensitivityEl.addEventListener("change", () => {
    send("settings:set", { sensitivity: sensitivityEl.value });
  });

  $("save-blocked").addEventListener("click", async () => {
    const domains = splitDomains(blockedEl.value);
    const blocklist = await send("blocklist:get");
    if (!blocklist) return;
    const next = { blocked: domains, allowed: blocklist.allowed };
    // apply via remove-then-add so we can also replace stale entries
    for (const d of blocklist.blocked) {
      await send("blocklist:remove", d);
    }
    for (const d of domains) {
      await send("blocklist:add", d);
    }
    showMsg(blockedMsg, "Blocked list saved (" + domains.length + " sites).");
  });

  $("save-allowed").addEventListener("click", async () => {
    const domains = splitDomains(allowedEl.value);
    const blocklist = await send("blocklist:get");
    if (!blocklist) return;
    for (const d of blocklist.allowed) {
      await send("blocklist:remove", d);
    }
    for (const d of domains) {
      await send("blocklist:addAllowed", d);
    }
    showMsg(allowedMsg, "Trusted list saved (" + domains.length + " sites).");
  });

  exportBtn.addEventListener("click", async () => {
    const blocklist = await send("blocklist:get");
    const settings = await send("settings:get");
    if (!blocklist) return;
    const payload = {
      app: "ScamGuard",
      version: "1.0.1",
      exported: new Date().toISOString(),
      settings: settings || {},
      blocklist: blocklist
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "scamguard-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
    showMsg(dataMsg, "Backup downloaded.");
  });

  importBtn.addEventListener("click", () => importFile.click());

  importFile.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed.blocklist) throw new Error("Invalid backup file");

      const bl = await send("blocklist:get");
      if (!bl) return;
      for (const d of bl.blocked) await send("blocklist:remove", d);
      for (const d of bl.allowed) await send("blocklist:remove", d);
      for (const d of (parsed.blocklist.blocked || [])) await send("blocklist:add", d);
      for (const d of (parsed.blocklist.allowed || [])) await send("blocklist:addAllowed", d);

      if (parsed.settings) {
        await send("settings:set", parsed.settings);
      }

      await loadAll();
      showMsg(dataMsg, "Import complete.");
    } catch (err) {
      showMsg(dataMsg, "Import failed: please choose a valid backup file.", true);
    }
    importFile.value = "";
  });

  resetStatsBtn.addEventListener("click", async () => {
    await send("stats:reset");
    const stats = await send("stats:get");
    statsText.textContent = "Sites checked: " + (stats ? stats.total : 0) +
      "  |  Fake warnings: " + (stats ? stats.danger : 0);
    showMsg(dataMsg, "Stats reset.");
  });

  loadAll();
})();
