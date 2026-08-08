// Scam Guard - release helper
// Bumps manifest.json version, runs tests, builds, and prints the git commands.
// Usage: node tools/release.mjs 1.1.0
//
// This keeps the flow simple:
//   node tools/release.mjs 1.1.0
//   git push origin main --tags

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = join(root, "manifest.json");

const newVersion = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(newVersion || "")) {
  console.error("Usage: node tools/release.mjs <x.y.z>   (e.g. node tools/release.mjs 1.1.0)");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const oldVersion = manifest.version;
if (oldVersion === newVersion) {
  console.error("Version " + newVersion + " is already set. Use a higher version.");
  process.exit(1);
}

manifest.version = newVersion;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log("Bumped manifest version: " + oldVersion + " -> " + newVersion);

console.log("\nRunning tests...");
const test = spawnSync(process.execPath, [join(root, "tools", "test-detector.mjs")], { stdio: "inherit" });
if (test.status !== 0) {
  console.error("Tests failed. Reverting version.");
  manifest.version = oldVersion;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  process.exit(1);
}

console.log("\nBuilding upload zip...");
const build = spawnSync(process.execPath, [join(root, "tools", "build.mjs")], { stdio: "inherit" });
if (build.status !== 0) {
  console.error("Build failed.");
  process.exit(1);
}

console.log("\n=== NEXT STEPS ===");
console.log("1. Commit the version bump:");
console.log("   git add manifest.json");
console.log('   git commit -m "release: v' + newVersion + '"');
console.log("2. Push the source (feed + docs live):");
console.log("   git push origin main");
console.log("3. Upload to stores with credentials (tools/upload.mjs):");
console.log("   node tools/upload.mjs edge --publish");
console.log("   node tools/upload.mjs firefox --publish");
console.log("   (Chrome/Opera: manual. Edge: wait if an earlier submission is in review.)");
console.log("4. OR tag it (GitHub Actions needs BPP_KEYS secret set first):");
console.log("   git tag v" + newVersion);
console.log("   git push origin main --tags");
