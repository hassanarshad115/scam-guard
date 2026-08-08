// Scam Guard - production build script
// 1. runs the detector self-test
// 2. copies the extension into dist/
// 3. minifies JS/CSS/HTML (comments + indentation, safe for ASI)
// 4. creates store upload zips (firefox variant + Chrome/Edge variant)

import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, sep } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = dirname();
const srcDir = join(root, "src");
const distDir = join(root, "dist");

function dirname() {
  return fileURLToPath(new URL("..", import.meta.url));
}

// ---------- Step 1: run tests ----------
console.log("[1/5] Running detector tests...");
const test = spawnSync(process.execPath, [join(root, "tools", "test-detector.mjs")], { stdio: "inherit" });
if (test.status !== 0) {
  console.error("Tests failed. Build aborted.");
  process.exit(1);
}
console.log("[1/5] Running service-worker tests...");
const testSw = spawnSync(process.execPath, [join(root, "tools", "test-service-worker.mjs")], { stdio: "inherit" });
if (testSw.status !== 0) {
  console.error("Service-worker tests failed. Build aborted.");
  process.exit(1);
}

// ---------- Step 2: copy ----------
console.log("[2/5] Copying extension into dist/ ...");
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const item of ["manifest.json", "_locales", "assets", "src"]) {
  cpSync(join(root, item), join(distDir, item), { recursive: true });
}

// ---------- Step 3: minify ----------
console.log("[3/5] Minifying files...");
const files = walk(distDir, []).filter(f =>
  f.endsWith(".js") || f.endsWith(".css") || f.endsWith(".html")
);
let minified = 0;
for (const file of files) {
  const original = readFileSync(file, "utf8");
  const out = minifyFile(file, original);
  if (out !== original) { writeFileSync(file, out, "utf8"); minified++; }
}
console.log("   Minified " + minified + " of " + files.length + " files.");

// ---------- Step 4: re-run all tests against the minified dist build ----------
console.log("[4/5] Re-running tests against the minified dist build...");
const testDist = spawnSync(process.execPath, [join(root, "tools", "test-detector.mjs"), distDir], { stdio: "inherit" });
if (testDist.status !== 0) {
  console.error("Dist detector tests failed. Build aborted.");
  process.exit(1);
}
const testDistSw = spawnSync(process.execPath, [join(root, "tools", "test-service-worker.mjs"), distDir], { stdio: "inherit" });
if (testDistSw.status !== 0) {
  console.error("Dist service-worker tests failed. Build aborted.");
  process.exit(1);
}

// ---------- Step 5: zip ----------
console.log("[5/5] Creating store upload zips...");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const version = manifest.version;

// Root manifest is the Chrome/Edge variant (service_worker only).
const chromeManifest = manifest;

// Firefox variant: drop the ignored service_worker, use background.scripts.
const firefoxManifest = JSON.parse(JSON.stringify(manifest));
if (firefoxManifest.background) {
  delete firefoxManifest.background.service_worker;
  firefoxManifest.background.scripts = [
    "src/detector/detector.js",
    "src/background/service-worker.js"
  ];
}

const pyPath = spawnSync("python", ["--version"], { stdio: "ignore" }).status === 0 ? "python" : "python3";

function createZip(zipName, manifestObj) {
  writeFileSync(join(distDir, "manifest.json"), JSON.stringify(manifestObj, null, 2), "utf8");
  const zipPath = join(distDir, zipName);
  rmSync(zipPath, { force: true });
  const py = spawnSync(pyPath, [
    "-c",
    [
      "import zipfile, os, sys",
      "root = sys.argv[1]; out = sys.argv[2]; entries = sys.argv[3:]",
      "with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:",
      "    for e in entries:",
      "        p = os.path.join(root, e)",
      "        if os.path.isfile(p):",
      "            z.write(p, os.path.relpath(p, root))",
      "        else:",
      "            for base, dirs, files in os.walk(p):",
      "                for f in files:",
      "                    fp = os.path.join(base, f)",
      "                    z.write(fp, os.path.relpath(fp, root))",
      "print('Created', out)",
    ].join("\n"),
    distDir, zipPath, "manifest.json", "_locales", "assets", "src"
  ], { stdio: "inherit" });
  if (py.status !== 0) {
    console.error("ZIP creation failed. Build aborted.");
    process.exit(1);
  }
  const size = statSync(zipPath).size;
  console.log("   " + zipName + "  (" + (size / 1024).toFixed(1) + " KB)");
}

// Opera variant: keep _locales/default_locale (Opera detects translations),
// but short_name must be a literal - Opera's validator measures the raw
// __MSG_ placeholder (28 chars) against its short_name length limit.
const operaManifest = JSON.parse(JSON.stringify(manifest));
operaManifest.short_name = "Scam Guard";

createZip("scamguard-v" + version + "-firefox.zip", firefoxManifest);
createZip("scamguard-v" + version + "-chrome.zip", chromeManifest);
createZip("scamguard-v" + version + "-edge.zip", chromeManifest);
createZip("scamguard-v" + version + "-opera.zip", operaManifest);

// dist/manifest.json stays as the Chrome/Edge variant for load-unpacked testing.
console.log("\nDone!");

function walk(dir, acc) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

// ---------- minifiers ----------
function minifyFile(path, code) {
  if (path.endsWith(".js")) return minifyJS(code);
  if (path.endsWith(".css")) return minifyCSS(code);
  return minifyHTML(code);
}

function stripComments(code) {
  let out = "";
  let i = 0;
  const n = code.length;
  let state = "code";            // code | single | double | template | regex
  let prevSig = "";              // last significant (non-whitespace) char emitted in code state
  let inRegexClass = false;      // inside a [...] character class of a regex
  const exprStart = new Set("(,=:[!&|?{};+-*%^~<>");

  while (i < n) {
    const c = code[i];
    const next = code[i + 1];

    if (state === "single") {
      out += c;
      if (c === "\\") { out += next || ""; i += 2; continue; }
      if (c === "'") state = "code";
      i++; continue;
    }
    if (state === "double") {
      out += c;
      if (c === "\\") { out += next || ""; i += 2; continue; }
      if (c === '"') state = "code";
      i++; continue;
    }
    if (state === "template") {
      out += c;
      if (c === "\\") { out += next || ""; i += 2; continue; }
      if (c === "`") state = "code";
      i++; continue;
    }
    if (state === "regex") {
      out += c;
      if (c === "\\") { out += next || ""; i += 2; continue; }
      if (c === "[") inRegexClass = true;
      else if (c === "]") inRegexClass = false;
      else if (c === "/" && !inRegexClass) { state = "code"; prevSig = "/"; }
      i++; continue;
    }

    if (c === "'") { state = "single"; out += c; prevSig = c; i++; continue; }
    if (c === '"') { state = "double"; out += c; prevSig = c; i++; continue; }
    if (c === "`") { state = "template"; out += c; prevSig = c; i++; continue; }
    if (c === "/" && next === "/") {
      while (i < n && code[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === "/" && (prevSig === "" || exprStart.has(prevSig))) {
      state = "regex";
      inRegexClass = false;
      out += c;
      i++;
      continue;
    }
    out += c;
    if (!/\s/.test(c)) prevSig = c;
    i++;
  }
  return out;
}

function stripIndent(code) {
  return code
    .split("\n")
    .map(line => line.replace(/^\s+/, "").replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function minifyJS(code) {
  return stripIndent(stripComments(code));
}

function minifyCSS(code) {
  return stripComments(code)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,])\s*/g, "$1")
    .trim();
}

function minifyHTML(code) {
  return stripComments(code)
    .split("\n")
    .map(line => line.replace(/^\s+/, "").replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
