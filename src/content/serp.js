// Scam Guard - search result labels (Google, Bing, DuckDuckGo)
// Flags risky links before you click. Everything runs locally.

(function () {
  "use strict";

  const host = window.location.hostname.toLowerCase();
  const engine =
    host.indexOf("google.") !== -1 ? "google" :
    host.indexOf("bing.") !== -1 ? "bing" :
    host.indexOf("duckduckgo.") !== -1 ? "ddg" : null;
  if (!engine) return;

  const labeled = new Set();
  const cache = new Map();
  const MAX_LABELED = 20;
  let scanTimer = null;

  const selectors =
    engine === "google" ? ["#rso a[href]", "#search a[href]"] :
    engine === "bing" ? ["li.b_algo h2 a[href]", "li.b_algo a[href]"] :
    ["a.result__a[href]"];

  function realTarget(a) {
    let href = a.href || "";
    if (engine === "google") {
      try {
        const u = new URL(href);
        if ((u.hostname === "www.google.com" || u.hostname === "google.com") && u.pathname.indexOf("/url") === 0) {
          const q = u.searchParams.get("q") || u.searchParams.get("url") || "";
          if (q) href = q;
        }
      } catch (err) { /* keep href */ }
    }
    if (href.indexOf("http://") !== 0 && href.indexOf("https://") !== 0) return null;
    try { new URL(href); return href; } catch (err) { return null; }
  }

  function tag(a, verdict) {
    if (a.getAttribute("data-sg-serp") === "1") return;
    a.setAttribute("data-sg-serp", "1");
    const span = document.createElement("span");
    span.className = "sg-serp-tag sg-serp-" + verdict;
    span.textContent = verdict === "danger" ? "\u26D4" : "\u26A0\uFE0F";
    span.setAttribute("title", verdict === "danger"
      ? "Scam Guard: likely fake site - do not click"
      : "Scam Guard: this link looks suspicious");
    try {
      a.insertBefore(span, a.firstChild);
    } catch (err) { /* noop */ }
  }

  function collect() {
    let done = 0;
    for (const sel of selectors) {
      const links = document.querySelectorAll(sel);
      for (const a of links) {
        if (done >= MAX_LABELED) return;
        if (labeled.has(a)) continue;
        labeled.add(a);
        const target = realTarget(a);
        if (!target) continue;

        if (cache.has(target)) {
          if (cache.get(target) !== "safe") { tag(a, cache.get(target)); done++; }
          continue;
        }
        if (cache.size > 200) {
          const first = cache.keys().next().value;
          if (first !== undefined) cache.delete(first);
        }
        chrome.runtime.sendMessage({ type: "analyze", url: target }, (res) => {
          if (chrome.runtime.lastError || !res) return;
          cache.set(target, res.verdict);
          if (res.verdict !== "safe") tag(a, res.verdict);
        });
      }
    }
  }

  collect();
  setTimeout(collect, 1500);

  if (typeof MutationObserver === "function") {
    const mo = new MutationObserver(() => {
      if (scanTimer) return;
      scanTimer = setTimeout(() => { scanTimer = null; collect(); }, 600);
    });
    try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (err) { /* noop */ }
  }
})();
