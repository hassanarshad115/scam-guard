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
  sensitivity: "medium"
};

const DEFAULT_BLOCKLIST = { blocked: [], allowed: [] };

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
      break;
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
