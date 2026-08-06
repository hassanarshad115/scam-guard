// Scam Guard - detector self-test
// Run: node tools/test-detector.mjs
// Verifies the engine catches fakes but does NOT flag real sites.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(root, "..", "src", "detector", "detector.js"), "utf8");
const sandbox = {};
const fn = new Function("self", code + "\nreturn self.ScamGuardDetector;");
const Detector = fn(sandbox);

const cases = [
  // [url, expectedVerdict, label]
  ["https://paypal.com/", "safe", "Real PayPal"],
  ["https://www.amazon.co.uk/gp/", "safe", "Real Amazon UK"],
  ["https://google.com/search?q=x", "safe", "Real Google"],
  ["https://github.com/login", "safe", "Real GitHub login"],
  ["https://example.com/", "safe", "Normal site"],
  ["https://en.wikipedia.org/wiki/Phishing", "safe", "Wikipedia"],
  ["https://bankofamerica.com/", "safe", "BofA real"],
  ["https://bankofamerica.com.online/", "danger", "BofA fake (.com.online trick)"],
  ["https://mail.google.com/mail/", "safe", "Real Gmail"],

  ["https://paypal-secure-login.xyz/", "danger", "PayPal lookalike .xyz"],
  ["https://paypal.com.xyz/", "danger", "PayPal TLD swapped"],
  ["https://g00gle-verify.top/login", "danger", "Google typo + verify"],
  ["https://accounts-google.com.security-check.club/", "danger", "Embedded google fake"],
  ["https://paypal.com@evil-site.xyz/", "danger", "at-sign trick"],
  ["https://192.168.1.1/verify.php", "caution", "private IP + verify"],
  ["https://www.paypa1-secure.net/", "danger", "paypal typo"],
  ["https://amaz0n-gift-card.site/", "danger", "amazon typo + gift"],
  ["https://hdfcbank.online/login", "danger", "bank lookalike .online"],
  ["https://xn--le-6kc8da.xyz/", "danger", "homograph (apple-like) .xyz"],
  ["https://your-bank-of-america.club/", "danger", "embedded brand .club"],

  ["https://free-prize-winner.tk/", "caution", "suspicious TLD"],
  ["https://login-verify.site/", "caution", "login keyword domain"]
];

let pass = 0, fail = 0;
for (const [url, expected, label] of cases) {
  const res = Detector.analyzeUrl(url, "medium");
  const ok = res.verdict === expected;
  if (ok) pass++; else fail++;
  console.log(
    (ok ? "PASS" : "FAIL") +
    "  [" + res.verdict + " (score " + res.score + ")] " + label + "  =>  " + url
  );
}

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail === 0 ? 0 : 1);
