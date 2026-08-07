// Scam Guard - background service worker
// Single source of truth for detection, blocklist, settings and stats.

if (typeof importScripts === "function") {
  importScripts("../detector/detector.js");
}

const storageArea = chrome.storage;

const DEFAULT_SETTINGS = {
  enableHeuristics: true,
  enableWarningOverlay: true,
  showCaution: false,
  sensitivity: "medium",
  warningMode: "full",
  enableLiveFeed: true,
  enableToasts: true
};

const DEFAULT_BLOCKLIST = { blocked: [], allowed: [] };

// ---- live phishing feed (served from the repo via jsDelivr) ----
const FEED_URL = "https://cdn.jsdelivr.net/gh/hassanarshad115/scam-guard@main/feed/feed.json";
const FEED_REFRESH_MS = 12 * 60 * 60 * 1000;
const FEED_ALARM_PERIOD_MIN = 720;

let feedCache = null;
let feedReady = null;

// Feed cache is in-memory only, so on every worker wake (MV3 suspends idle
// workers) we must reload it from storage before relying on it.
function ensureFeed() {
  if (feedReady) return feedReady;
  feedReady = (async () => {
    try {
      const stored = await storageArea.local.get({ feed: null });
      feedCache = feedFromStored(stored.feed);
    } catch (e) {
      feedCache = null;
    }
    return feedCache;
  })();
  return feedReady;
}

function feedFromStored(stored) {
  try {
    if (stored.text) {
      const list = stored.text.split("\n").filter(Boolean);
      return { generated: stored.generated || "", domains: new Set(list) };
    }
    if (Array.isArray(stored.domains)) {
      return { generated: stored.generated || "", domains: new Set(stored.domains) };
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function refreshFeed(force) {
  if (typeof fetch !== "function") return false;
  try {
    const stored = await storageArea.local.get({ feed: null });
    if (!force && stored.feed && stored.feed.ts && Date.now() - stored.feed.ts < FEED_REFRESH_MS) {
      feedCache = feedFromStored(stored.feed);
      feedReady = Promise.resolve(feedCache);
      return !!feedCache;
    }
    const url = FEED_URL + "?v=" + Math.floor(Date.now() / 86400000);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return false;
    const json = await res.json();
    if (!json || !Array.isArray(json.domains) || json.domains.length === 0) return false;
    feedCache = { generated: json.generated || "", domains: new Set(json.domains) };
    feedReady = Promise.resolve(feedCache);
    await storageArea.local.set({
      feed: { ts: Date.now(), generated: json.generated || "", text: json.domains.join("\n") }
    });
    return true;
  } catch (e) {
    return false;
  }
}

async function feedStatus() {
  const stored = await storageArea.local.get({ feed: null });
  if (stored.feed && stored.feed.text) {
    return {
      count: stored.feed.text.split("\n").filter(Boolean).length,
      generated: stored.feed.generated || "",
      ts: stored.feed.ts || 0
    };
  }
  return { count: 0, generated: "", ts: 0 };
}

// Fast lookup: exact hostname first, then each parent domain.
function feedLookup(rawUrl) {
  if (!feedCache || !feedCache.domains) return null;
  let host = "";
  try { host = new URL(rawUrl).hostname.toLowerCase(); } catch (e) { return null; }
  if (host.startsWith("www.")) host = host.slice(4);
  const parts = host.split(".");
  for (let i = 0; i < parts.length; i++) {
    const sub = parts.slice(i).join(".");
    if (feedCache.domains.has(sub)) return sub;
  }
  return null;
}

// ---- in-memory URL cache (cleared automatically when worker sleeps) ----
const cache = new Map();
const CACHE_MAX = 500;
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheGet(url) {
  const hit = cache.get(url);
  if (!hit) return null;
  if (Date.now() - hit.t > CACHE_TTL_MS) { cache.delete(url); return null; }
  return hit.v;
}

function cacheSet(url, value) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(url, { t: Date.now(), v: value });
}

async function getSettings() {
  const data = await storageArea.local.get({ settings: DEFAULT_SETTINGS });
  return Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
}

async function getBlocklist() {
  const data = await storageArea.local.get({ blocklist: DEFAULT_BLOCKLIST });
  return Object.assign({ blocked: [], allowed: [] }, data.blocklist || {});
}

async function saveBlocklist(blocklist) {
  await storageArea.local.set({ blocklist: blocklist });
}

function domainMatches(url, domain) {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const d = String(domain).toLowerCase().replace(/^www\./, "");
    if (!d) return false;
    return hostname === d || hostname.endsWith("." + d);
  } catch (e) {
    return false;
  }
}

async function analyze(rawUrl) {
  const cached = cacheGet(rawUrl);
  if (cached) return cached;

  const settings = await getSettings();
  const blocklist = await getBlocklist();

  let result = settings.enableHeuristics
    ? ScamGuardDetector.analyzeUrl(rawUrl, settings.sensitivity)
    : { score: 0, verdict: "safe", reasons: [], hostname: "" };

  let userAllowed = false;

  // user blocklist overrides
  for (let i = 0; i < blocklist.blocked.length; i++) {
    if (domainMatches(rawUrl, blocklist.blocked[i])) {
      result = { score: 100, verdict: "danger", reasons: ["You blocked this site yourself."], hostname: result.hostname };
      break;
    }
  }
  for (let i = 0; i < blocklist.allowed.length; i++) {
    if (domainMatches(rawUrl, blocklist.allowed[i])) {
      result = { score: 0, verdict: "safe", reasons: [], hostname: result.hostname };
      userAllowed = true;
      break;
    }
  }

  // live phishing feed (skipped when the user explicitly allowed the site)
  if (!userAllowed && settings.enableLiveFeed) {
    await ensureFeed();
    const feedHit = feedLookup(rawUrl);
    if (feedHit) {
      result = {
        score: 100,
        verdict: "danger",
        reasons: ["This domain (" + feedHit + ") is listed on a live phishing blacklist."],
        hostname: result.hostname
      };
    }
  }

  if (result.verdict === "caution" && !settings.showCaution) {
    result = Object.assign({}, result, { verdict: "safe", reasons: [] });
  }

  cacheSet(rawUrl, result);

  try {
    const stats = await storageArea.local.get({ stats: { total: 0, danger: 0 } });
    stats.stats.total = (stats.stats.total || 0) + 1;
    if (result.verdict === "danger") stats.stats.danger = (stats.stats.danger || 0) + 1;
    await storageArea.local.set({ stats: stats.stats });
  } catch (e) { /* best effort */ }

  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return undefined;

  (async () => {
    switch (message.type) {
      case "analyze":
        sendResponse(await analyze(String(message.url || "")));
        break;
      case "blocklist:get":
        sendResponse(await getBlocklist());
        break;
      case "blocklist:add": {
        const bl = await getBlocklist();
        const val = String(message.value || "").trim().toLowerCase();
        if (val && bl.blocked.indexOf(val) === -1) { bl.blocked.push(val); await saveBlocklist(bl); cache.clear(); }
        sendResponse(bl);
        break;
      }
      case "blocklist:addAllowed": {
        const bl = await getBlocklist();
        const val = String(message.value || "").trim().toLowerCase();
        if (val && bl.allowed.indexOf(val) === -1) { bl.allowed.push(val); await saveBlocklist(bl); cache.clear(); }
        sendResponse(bl);
        break;
      }
      case "blocklist:remove": {
        const bl = await getBlocklist();
        const val = String(message.value || "").trim().toLowerCase();
        bl.blocked = bl.blocked.filter(x => x !== val);
        bl.allowed = bl.allowed.filter(x => x !== val);
        await saveBlocklist(bl);
        cache.clear();
        sendResponse(bl);
        break;
      }
      case "stats:get": {
        const data = await storageArea.local.get({ stats: { total: 0, danger: 0 } });
        sendResponse(data.stats);
        break;
      }
      case "stats:reset": {
        await storageArea.local.set({ stats: { total: 0, danger: 0 } });
        sendResponse({ total: 0, danger: 0 });
        break;
      }
      case "feed:status":
        sendResponse(await feedStatus());
        break;
      case "report:add": {
        const data = await storageArea.local.get({ reports: [] });
        const arr = data.reports || [];
        arr.push({ url: String(message.url || ""), ts: Date.now() });
        if (arr.length > 500) arr.splice(0, arr.length - 500);
        await storageArea.local.set({ reports: arr });
        sendResponse({ ok: true, count: arr.length });
        break;
      }
      case "settings:get":
        sendResponse(await getSettings());
        break;
      case "settings:set": {
        const s = await getSettings();
        const next = Object.assign({}, s, message.value || {});
        await storageArea.local.set({ settings: next });
        cache.clear();
        sendResponse(next);
        break;
      }
      default:
        sendResponse({ error: "unknown message type" });
    }
  })();
  return true;
});

// ---- toolbar badge: show the verdict directly on the extension icon ----
const BADGE_COLORS = {
  safe: [34, 197, 94],
  caution: [245, 158, 11],
  danger: [239, 68, 68],
  off: [80, 80, 95]
};

function setBadge(tabId, text, color) {
  try {
    chrome.action.setBadgeText({ tabId: tabId, text: text });
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: color });
  } catch (e) { /* badge API unavailable in this browser */ }
}

function badgeFor(result, settings) {
  if (result.verdict === "danger") return { text: "!", color: BADGE_COLORS.danger };
  if (result.verdict === "caution" && settings.showCaution) return { text: "!", color: BADGE_COLORS.caution };
  return { text: "\u2713", color: BADGE_COLORS.safe };
}

async function updateBadgeForTab(tabId, url) {
  if (!url || (url.indexOf("http://") !== 0 && url.indexOf("https://") !== 0)) {
    setBadge(tabId, "", BADGE_COLORS.off);
    return;
  }
  try {
    const result = await analyze(url);
    const settings = await getSettings();
    const b = badgeFor(result, settings);
    setBadge(tabId, b.text, b.color);
  } catch (e) { /* ignore */ }
}

chrome.tabs.onActivated.addListener((info) => {
  chrome.tabs.get(info.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;
    updateBadgeForTab(tab.id, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo || changeInfo.status !== "loading") return;
  if (chrome.runtime.lastError || !tab) return;
  updateBadgeForTab(tabId, tab.url);
});

// ---- live feed lifecycle (guarded so every browser/API combination works) ----
function attachEvent(api, name, fn) {
  const target = api && api[name];
  if (target && typeof target.addListener === "function") target.addListener(fn);
}

// Load the feed from storage on every worker start so verdicts stay consistent
// even after Chrome suspends and wakes the service worker.
ensureFeed();

attachEvent(chrome.runtime, "onInstalled", () => { refreshFeed(true); createMenu(); });
attachEvent(chrome.runtime, "onStartup", () => { refreshFeed(true); });
attachEvent(chrome.alarms, "onAlarm", (alarm) => {
  if (alarm && alarm.name === "feed-refresh") refreshFeed(true);
});
if (chrome.alarms && typeof chrome.alarms.create === "function") {
  try {
    chrome.alarms.create("feed-refresh", { periodInMinutes: FEED_ALARM_PERIOD_MIN });
  } catch (e) { /* ignore */ }
}

// ---- right-click: check any link ----
function createMenu() {
  if (!chrome.contextMenus) return;
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "sg-check-link",
        title: "Check this link with Scam Guard",
        contexts: ["link"]
      });
    });
  } catch (e) { /* ignore */ }
}

attachEvent(chrome.contextMenus, "onClicked", (info) => {
  if (!info || info.menuItemId !== "sg-check-link" || !info.linkUrl) return;
  analyze(info.linkUrl).then(notify);
});

function notify(result) {
  if (!chrome.notifications) return;
  const level = result.verdict === "danger" ? "danger" : result.verdict === "caution" ? "caution" : "safe";
  const host = result.hostname || "";
  const message =
    level === "danger"
      ? host + " - this link is a known phishing/scam site. Do not enter any details."
      : level === "caution"
        ? host + " - this link looks suspicious."
        : host + " - this link looks safe.";
  try {
    chrome.notifications.create("sg-link-check", {
      type: "basic",
      iconUrl: "assets/icons/icon128.png",
      title: level === "danger" ? "Scam Guard: DANGER" : level === "caution" ? "Scam Guard: Caution" : "Scam Guard: Safe",
      message: message,
      priority: level === "danger" ? 2 : 0
    });
  } catch (e) { /* ignore */ }
}
