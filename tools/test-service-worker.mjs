// Scam Guard - service worker integration self-test
// Run: node tools/test-service-worker.mjs
// Loads the real detector + service worker with a mocked chrome API
// and verifies analyze / blocklist / settings / stats / cache behavior.

import { readFileSync } from "fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

const detectorCode = readFileSync(join(root, "..", "src", "detector", "detector.js"), "utf8");
const sandbox = {};
const Detector = new Function("self", detectorCode + "\nreturn self.ScamGuardDetector;")(sandbox);

const store = {};
let handler = null;
let badgeCalls = [];
let tabs = new Map();
let activatedHandler = null;
let updatedHandler = null;
let installedHandler = null;
let startupHandler = null;
const chrome = {
  storage: {
    local: {
      async get(defaults) {
        const out = {};
        for (const k in defaults) out[k] = (k in store) ? store[k] : defaults[k];
        return out;
      },
      async set(obj) { Object.assign(store, obj); }
    }
  },
  runtime: {
    lastError: null,
    openOptionsPage() {},
    onMessage: { addListener(fn) { handler = fn; } },
    onInstalled: { addListener(fn) { installedHandler = fn; } },
    onStartup: { addListener(fn) { startupHandler = fn; } }
  },
  tabs: {
    get(id, cb) { cb(tabs.get(id)); },
    onActivated: { addListener(fn) { activatedHandler = fn; } },
    onUpdated: { addListener(fn) { updatedHandler = fn; } }
  },
  alarms: {
    create() {},
    onAlarm: { addListener() {} }
  },
  contextMenus: {
    removeAll(cb) { cb(); },
    create() {},
    onClicked: { addListener() {} }
  },
  action: {
    setBadgeText(call) { badgeCalls.push({ kind: "text", ...call }); },
    setBadgeBackgroundColor(call) { badgeCalls.push({ kind: "color", ...call }); }
  }
};

const workerCode = readFileSync(join(root, "..", "src", "background", "service-worker.js"), "utf8");
const ctx = {
  chrome, console, URL, importScripts: () => {}, ScamGuardDetector: Detector,
  fetch: async () => { throw new Error("fetch not stubbed"); }
};
createContext(ctx);
runInContext(workerCode, ctx);

function send(message) {
  return new Promise((resolve) => {
    handler(message, {}, (res) => resolve(res));
  });
}

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log("PASS  " + label); }
  else { fail++; console.log("FAIL  " + label + (extra ? "  => " + JSON.stringify(extra) : "")); }
}

const analyze = (url) => send({ type: "analyze", url: url });

// --- basic detection through the worker ---
const r1 = await analyze("https://paypal.com/");
check("real paypal -> safe", r1.verdict === "safe", r1);

const r2 = await analyze("https://paypal-secure-login.xyz/");
check("lookalike -> danger", r2.verdict === "danger", r2);
check("danger has reasons", Array.isArray(r2.reasons) && r2.reasons.length > 0);

const stats1 = await send({ type: "stats:get" });
check("stats counted 2 distinct URLs", stats1.total === 2 && stats1.danger === 1, stats1);

await analyze("https://paypal.com/");
const stats2 = await send({ type: "stats:get" });
check("cache: re-analyze did not double count", stats2.total === 2, stats2);

// --- at-sign trick through worker ---
const r3 = await analyze("https://paypal.com@evil-site.xyz/");
check("at-sign trick -> danger", r3.verdict === "danger", r3);

// --- user blocklist ---
let bl = await send({ type: "blocklist:add", value: "evil-site.xyz" });
check("blocklist add", bl.blocked.indexOf("evil-site.xyz") !== -1, bl);

const r4 = await analyze("https://evil-site.xyz/login");
check("blocked site -> danger score 100", r4.verdict === "danger" && r4.score === 100, r4);
check("blocked site has block reason", (r4.reasons || []).join("").indexOf("You blocked this site yourself.") !== -1, r4);

await send({ type: "blocklist:add", value: "amazon.com" });
const r4b = await analyze("https://www.amazon.com/");
check("www subdomain matches blocked root", r4b.verdict === "danger", r4b);
const r4c = await analyze("https://amazon.co.uk/");
check("different domain NOT blocked by root", r4c.verdict === "safe", r4c);

// --- allowlist overrides blocklist ---
await send({ type: "blocklist:addAllowed", value: "evil-site.xyz" });
const r5 = await analyze("https://evil-site.xyz/login");
check("allowed overrides blocked", r5.verdict === "safe", r5);

// --- remove from both lists ---
bl = await send({ type: "blocklist:remove", value: "evil-site.xyz" });
check("remove from both lists", bl.blocked.indexOf("evil-site.xyz") === -1 && bl.allowed.indexOf("evil-site.xyz") === -1, bl);
await send({ type: "blocklist:remove", value: "amazon.com" });

// --- caution handling ---
const r6 = await analyze("https://free-prize-winner.tk/");
check("caution hidden by default -> safe", r6.verdict === "safe", r6);

await send({ type: "settings:set", value: { showCaution: true } });
const r7 = await analyze("https://free-prize-winner.tk/");
check("showCaution on -> caution", r7.verdict === "caution", r7);
await send({ type: "settings:set", value: { showCaution: false } });

// --- heuristics toggle ---
await send({ type: "settings:set", value: { enableHeuristics: false } });
const r8 = await analyze("https://paypal-secure-login.xyz/");
check("heuristics off -> safe", r8.verdict === "safe", r8);
await send({ type: "settings:set", value: { enableHeuristics: true } });
const r9 = await analyze("https://paypal-secure-login.xyz/");
check("heuristics back on -> danger", r9.verdict === "danger", r9);

// --- settings defaults ---
const s = await send({ type: "settings:get" });
check("sensitivity default medium", s.sensitivity === "medium", s);

// --- stats reset ---
const reset = await send({ type: "stats:reset" });
check("stats reset", reset.total === 0 && reset.danger === 0, reset);

// --- unknown message ---
const bad = await send({ type: "nonsense", value: 1 });
check("unknown message -> error", bad && bad.error === "unknown message type", bad);

// --- live phishing feed ---
const feedDomains = ["evil-feed.xyz", "steal-login.site"];
ctx.fetch = async () => ({
  ok: true,
  json: async () => ({ generated: "2026-08-07T00:00:00Z", domains: feedDomains })
});
if (startupHandler) await startupHandler();
await new Promise(r => setTimeout(r, 10));

const f1 = await send({ type: "feed:status" });
check("feed loaded 2 domains", f1.count === 2, f1);

const rF1 = await analyze("https://evil-feed.xyz/login");
check("feed domain -> danger", rF1.verdict === "danger", rF1);
check("feed reason shown", (rF1.reasons || []).join("").indexOf("phishing blacklist") !== -1, rF1);

const rF2 = await analyze("https://sub.evil-feed.xyz/");
check("feed parent-domain match -> danger", rF2.verdict === "danger", rF2);

const rF3 = await analyze("https://legit.example.com/");
check("non-feed domain stays safe", rF3.verdict === "safe", rF3);

await send({ type: "blocklist:addAllowed", value: "evil-feed.xyz" });
const rF4 = await analyze("https://evil-feed.xyz/");
check("allowlist overrides feed", rF4.verdict === "safe", rF4);
await send({ type: "blocklist:remove", value: "evil-feed.xyz" });

// feed disabled by setting
await send({ type: "settings:set", value: { enableLiveFeed: false } });
const rF5 = await analyze("https://steal-login.site/");
check("feed disabled -> safe", rF5.verdict === "safe", rF5);
await send({ type: "settings:set", value: { enableLiveFeed: true } });
const rF6 = await analyze("https://steal-login.site/");
check("feed re-enabled -> danger", rF6.verdict === "danger", rF6);

// --- local reports ---
const rep1 = await send({ type: "report:add", url: "https://steal-login.site/" });
check("report stored", rep1 && rep1.ok && rep1.count === 1, rep1);
const rep2 = await send({ type: "report:add", url: "https://steal-login.site/x" });
check("second report stored", rep2 && rep2.ok && rep2.count === 2, rep2);

// --- toolbar badge ---
function lastBadge(kind) {
  for (let i = badgeCalls.length - 1; i >= 0; i--) {
    if (badgeCalls[i].kind === kind) return badgeCalls[i];
  }
  return null;
}

tabs.set(1, { id: 1, url: "https://paypal.com/" });
activatedHandler({ tabId: 1 });
await new Promise(r => setTimeout(r, 20));
let bt = lastBadge("text");
check("badge safe tab -> checkmark", bt && bt.text === "\u2713", bt);
check("badge safe tab -> green color", lastBadge("color") && JSON.stringify(lastBadge("color").color) === JSON.stringify([34, 197, 94]), lastBadge("color"));

tabs.set(1, { id: 1, url: "https://paypal-secure-login.xyz/" });
updatedHandler(1, { status: "loading" }, tabs.get(1));
await new Promise(r => setTimeout(r, 20));
bt = lastBadge("text");
check("badge danger tab -> exclamation", bt && bt.text === "!", bt);
check("badge danger tab -> red color", lastBadge("color") && JSON.stringify(lastBadge("color").color) === JSON.stringify([239, 68, 68]), lastBadge("color"));

tabs.set(1, { id: 1, url: "https://example.com/" });
activatedHandler({ tabId: 1 });
await new Promise(r => setTimeout(r, 20));
bt = lastBadge("text");
check("badge safe normal site -> checkmark", bt && bt.text === "\u2713", bt);

tabs.set(1, { id: 1, url: "about:blank" });
activatedHandler({ tabId: 1 });
await new Promise(r => setTimeout(r, 20));
bt = lastBadge("text");
check("badge non-http -> cleared", bt && bt.text === "", bt);

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail === 0 ? 0 : 1);
