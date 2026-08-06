// Scam Guard - production build script
// 1. runs the detector self-test
// 2. copies the extension into dist/
// 3. minifies JS/CSS/HTML (comments + indentation, safe for ASI)
// 4. creates store upload zip (Chrome / Edge / Opera / Firefox compatible)

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
console.log("[1/4] Running detector tests...");
const test = spawnSync(process.execPath, [join(root, "tools", "test-detector.mjs")], { stdio: "inherit" });
if (test.status !== 0) {
  console.error("Tests failed. Build aborted.");
  process.exit(1);
}

// ---------- Step 2: copy ----------
console.log("[2/4] Copying extension into dist/ ...");
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const item of ["manifest.json", "_locales", "assets", "src"]) {
  cpSync(join(root, item), join(distDir, item), { recursive: true });
}

// ---------- Step 3: minify ----------
console.log("[3/4] Minifying files...");
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

// ---------- Step 4: zip ----------
console.log("[4/4] Creating upload zip...");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const version = manifest.version;
const zipName = "scamguard-v" + version + ".zip";
const zipPath = join(distDir, zipName);
rmSync(zipPath, { force: true });

const pyPath = spawnSync("python", ["--version"], { stdio: "ignore" }).status === 0 ? "python" : "python3";
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
  root, zipPath, "manifest.json", "_locales", "assets", "src"
], { stdio: "inherit" });

if (py.status !== 0) {
  console.error("ZIP creation failed. Build aborted.");
  process.exit(1);
}

// size summary
const size = statSync(zipPath).size;
console.log("\nDone! Upload file: " + zipPath + "  (" + (size / 1024).toFixed(1) + " KB)");

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
