// Scam Guard - store upload helper
// Uploads the current build to Edge (v1.1 Publish API) or Firefox (AMO v5 API).
//
// Credentials are read from secrets/store-credentials.json.
//   Edge:    edge.clientId + edge.apiKey + edge.addonId (= productID)
//   Firefox: firefox.jwtIssuer + firefox.jwtSecret + firefox.addonId
//
// Usage:
//   node tools/upload.mjs edge [--publish]
//   node tools/upload.mjs firefox [--publish]
//
// Without --publish the package is uploaded as a draft / new version but is
// NOT submitted for certification. Add --publish to submit it.
//
// NOTE: Edge rejects publishing while an earlier submission is still in
// review (error InProgressSubmission), so wait until v1.0.1 is live first.

import { readFileSync, existsSync } from "fs";
import { createHmac } from "crypto";
import { join } from "path";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL("..", import.meta.url));
const CREDS_PATH = join(root, "secrets", "store-credentials.json");
const FEEDBACK_MS = 15000;

const args = process.argv.slice(2);
const store = args.find(a => a === "edge" || a === "firefox");
const publish = args.includes("--publish");

if (!store) {
  console.error("Usage: node tools/upload.mjs <edge|firefox> [--publish]");
  process.exit(1);
}

let creds;
try {
  creds = JSON.parse(readFileSync(CREDS_PATH, "utf8"));
} catch (e) {
  console.error("Missing/invalid credentials file: " + CREDS_PATH);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const version = manifest.version;
const zip = join(root, "dist", "scamguard-v" + version + "-" + store + ".zip");
if (!existsSync(zip)) {
  console.error("Zip not found: " + zip + "  (run node tools/build.mjs first)");
  process.exit(1);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------- Edge (v1.1 Publish API) ----------
async function uploadEdge() {
  const c = creds.stores.edge || {};
  if (!c.clientId || !c.apiKey) fail("Edge needs clientId + apiKey in secrets/store-credentials.json");
  if (!c.addonId) fail("Edge needs addonId (Product ID from Partner Center) - see guides/edge-upload-guide.md");

  const base = "https://api.addons.microsoftedge.microsoft.com/v1/products/" + c.addonId + "/submissions";
  const headers = { "Authorization": "ApiKey " + c.apiKey, "X-ClientID": c.clientId };

  console.log("[edge] uploading " + zip + " as v" + version + " ...");
  const up = await fetch(base + "/draft/package", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/zip" }, headers),
    body: readFileSync(zip)
  });
  const opId = up.headers.get("location");
  if (!up.ok || !opId) {
    const body = await up.text();
    fail("[edge] upload failed (" + up.status + "): " + (body || "no operation id"));
  }
  console.log("[edge] upload accepted, operation " + opId + " - waiting for result...");
  await waitEdgeOp(base + "/draft/package/operations/" + opId, headers, "upload");

  if (!publish) {
    console.log("\n[edge] DONE - package is a DRAFT. Submit it when ready:");
    console.log("  node tools/upload.mjs edge --publish");
    return;
  }

  console.log("[edge] publishing draft...");
  const pub = await fetch(base, {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, headers),
    body: JSON.stringify({ notes: "Scam Guard v" + version })
  });
  const pubOp = pub.headers.get("location");
  if (!pub.ok || !pubOp) {
    const body = await pub.text();
    fail("[edge] publish failed (" + pub.status + "): " + (body || "no operation id"));
  }
  console.log("[edge] publish accepted, operation " + pubOp + " - waiting for result...");
  await waitEdgeOp(base + "/operations/" + pubOp, headers, "publish");
  console.log("[edge] DONE - v" + version + " submitted for certification.");
}

async function waitEdgeOp(url, headers, label) {
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    const res = await fetch(url, { headers });
    const data = await res.json().catch(() => ({}));
    const status = (data.status || "").toLowerCase();
    if (status === "succeeded" || status === "completed") { console.log("[edge] " + label + ": " + status); return; }
    if (status === "failed") fail("[edge] " + label + " failed: " + (data.message || JSON.stringify(data)));
    if (i % 3 === 2) console.log("[edge] " + label + " status: " + (status || "processing..."));
  }
  fail("[edge] " + label + " timed out. Check Partner Center dashboard.");
}

// ---------- Firefox (AMO v5 API) ----------
function amoJwt(issuer, secret) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = b64({ iss: issuer, iat: now, exp: now + 300 });
  const sig = createHmac("sha256", secret).update(header + "." + payload).digest("base64url");
  return header + "." + payload + "." + sig;
}

async function uploadFirefox() {
  const c = creds.stores.firefox || {};
  if (!c.jwtIssuer || !c.jwtSecret) fail("Firefox needs jwtIssuer + jwtSecret (AMO API keys) in secrets/store-credentials.json");
  if (!c.addonId) fail("Firefox needs addonId in secrets/store-credentials.json");

  const url = "https://addons.mozilla.org/api/v5/addons/" + c.addonId + "/versions/" + version + "/";
  const token = amoJwt(c.jwtIssuer, c.jwtSecret);
  const fd = new FormData();
  fd.append("upload", new Blob([readFileSync(zip)], { type: "application/zip" }), "scamguard-" + version + ".zip");

  console.log("[firefox] uploading " + zip + " as v" + version + " ...");
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Authorization": "JWT " + token },
    body: fd
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    fail("[firefox] upload failed (" + res.status + "): " + JSON.stringify(data));
  }
  const status = data.status || data.reviewed || "unknown";
  console.log("[firefox] version status: " + status + (publish ? "" : " (NOT submitted yet)"));

  if (publish && data.status === "unlisted") {
    console.log("[firefox] note: version is unlisted - it is on AMO but hidden until approved.");
  }
  console.log("[firefox] DONE - see https://addons.mozilla.org/developers/addons/" + c.addonId + "/versions/");
}

if (store === "edge") {
  uploadEdge().catch(e => fail("[edge] error: " + (e && e.message)));
} else {
  uploadFirefox().catch(e => fail("[firefox] error: " + (e && e.message)));
}
