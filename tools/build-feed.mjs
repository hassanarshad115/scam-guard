// Scam Guard - live phishing feed builder
// Pulls the public CERT.PL phishing domain list, normalizes it to hostnames,
// filters out protected legitimate domains, and writes feed/feed.json
// (served to the extension via jsDelivr).
//
// Source (public, no API key):
//   cert.pl    https://hole.cert.pl/domains/domains.txt
//
// Notes:
//   - OpenPhish and URLhaus are NOT used. OpenPhish's feed is a URL feed that
//     cannot be redistributed, and URL-based feeds must never be converted into
//     whole-domain blocks. cert.pl is a DOMAIN feed, so whole-domain blocking
//     is the correct and intended match.
//
// Run: node tools/build-feed.mjs
// Output: feed/feed.json  { generated, count, domains: [] }

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = dirname(fileURLToPath(import.meta.url));
const MAX_DOMAINS = 250000;   // safety guard only - the full public lists are kept
const FETCH_TIMEOUT_MS = 15000;

// Reuse the detector's protected-domain rules so the build and the runtime
// always agree on which legitimate domains can never be blocked.
const detectorCode = readFileSync(join(root, "..", "src", "detector", "detector.js"), "utf8");
const sandbox = {};
const Detector = new Function("self", detectorCode + "\nreturn self.ScamGuardDetector;")(sandbox);
const isProtected = Detector.isProtectedDomain;

const SOURCES = [
  { name: "cert.pl", url: "https://hole.cert.pl/domains/domains.txt", mode: "domains" }
];

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "ScamGuard-feed-builder/1.0" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function hostFrom(entry, mode) {
  try {
    let raw = String(entry).trim().toLowerCase();
    if (!raw) return "";
    if (raw.startsWith("*.")) raw = raw.slice(2);
    if (raw.startsWith(".")) raw = raw.slice(1);
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(raw);
    const url = mode === "domains" && !hasScheme ? new URL("https://" + raw) : new URL(raw);
    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    if (host.length < 4) return "";
    if (host.indexOf(".") === -1) return "";
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return "";
    return host;
  } catch (e) {
    return "";
  }
}

const counts = new Map();
let seen = 0;

for (const source of SOURCES) {
  let text = "";
  try {
    text = await fetchText(source.url);
  } catch (e) {
    console.log("SKIP " + source.name + " (" + e.message + ")");
    continue;
  }
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    seen++;
    const host = hostFrom(line, source.mode);
    if (!host) continue;
    if (isProtected(host)) continue;
    counts.set(host, (counts.get(host) || 0) + 1);
  }
  console.log("OK   " + source.name + " (" + lines.length + " lines)");
}

if (counts.size === 0) {
  console.error("No data gathered from any source. Aborting.");
  process.exit(1);
}

// Alphabetical order keeps the committed feed stable (smaller git diffs).
const sorted = Array.from(counts.keys()).sort();
const capped = sorted.slice(0, MAX_DOMAINS);

const feed = {
  generated: new Date().toISOString(),
  count: capped.length,
  domains: capped
};

mkdirSync(join(root, "..", "feed"), { recursive: true });
writeFileSync(join(root, "..", "feed", "feed.json"), JSON.stringify(feed, null, 0) + "\n", "utf8");

console.log("Wrote feed/feed.json: " + capped.length + " domains (" + seen + " lines parsed).");
