// Scam Guard - detection engine
// 100% client-side. No network calls. Optimized for speed with Sets & label matching.

(function (root) {
  "use strict";

  const SUSPICIOUS_TLDS = new Set([
    "xyz", "top", "club", "online", "site", "icu", "tk", "ml", "ga", "cf", "gq",
    "click", "download", "zip", "mov", "review", "country", "rest", "stream",
    "cam", "work", "buzz", "lol", "fun", "hair", "cricket", "science", "support",
    "accountant", "gdn", "kim", "men", "xyz", "cfd", "sbs", "cyou", "quest",
    "mom", "loan", "win", "bet", "bid", "sale", "date", "racing"
  ]);

  const SECOND_LEVEL_TLDS = new Set([
    "com", "net", "org", "co", "gov", "edu", "io", "ai", "me", "info", "biz",
    "us", "uk", "in", "pk", "ca", "au", "de", "fr", "br", "app", "dev", "tech",
    "pro", "blog", "page", "website"
  ]);

  const SUSPICIOUS_KEYWORDS = [
    "login", "signin", "sign-in", "verify", "verification", "secure", "account",
    "update", "confirm", "wallet", "withdraw", "bonus", "prize", "lottery",
    "refund", "support", "banking", "netbank", "password", "recover", "unlock",
    "gift-card", "invoice", "billing", "identity", "kyc", "otp", "free-gift"
  ];

  const BRANDS = [
    "google", "youtube", "gmail", "facebook", "instagram", "whatsapp", "netflix",
    "amazon", "paypal", "apple", "icloud", "microsoft", "outlook", "office365",
    "yahoo", "ebay", "chase", "bankofamerica", "wellsfargo", "citi", "hsbc",
    "barclays", "bitcoin", "coinbase", "binance", "payoneer", "wise", "skype",
    "linkedin", "twitter", "xlogin", "telegram", "steam", "epicgames", "spotify",
    "dropbox", "mcafee", "norton", "godaddy", "canva", "adobe", "tiktok",
    "snapchat", "reddit", "roblox", "airbnb", "uber", "samsung", "xiaomi",
    "sbi", "hdfcbank", "icicibank", "kotak", "axisbank", "bmo", "rbc", "tdbank",
    "revolut", "amex", "visa", "mastercard", "irctc", "nagad", "bkash", "jazzcash",
    "easypaisa", "paytm", "phonepe", "gpay", "razorpay", "stripe", "zelle",
    "venmo", "cashapp", "westernunion", "moneygram", "worldremit",
    "metamask", "ledger", "trezor", "trustwallet", "phantom", "exodus", "bybit",
    "okx", "kucoin", "kraken", "robinhood", "etrade", "etoro", "schwab",
    "vanguard", "capitalone", "usbank", "pnc", "santander", "bbva", "lloyds",
    "natwest", "halifax", "nationwide", "monzo", "n26", "dbs", "maybank",
    "ocbc", "cimb", "itau", "nubank", "bradesco", "yesbank", "bankofbaroda",
    "adyen", "klarna", "afterpay", "remitly", "fedex", "usps", "dhl",
    "royalmail", "postoffice", "swiggy", "zomato", "dominos", "pizzahut",
    "starbucks", "burgerking", "flipkart", "myntra", "meesho", "bigbasket",
    "zepto", "blinkit", "ajio", "nykaa", "shopee", "lazada", "aliexpress",
    "temu", "etsy", "shein", "delhivery", "bluedart", "discord", "twitch",
    "fortnite", "riotgames", "minecraft", "pinterest", "quora", "tinder",
    "patreon", "kickstarter", "zalando", "nike", "adidas", "oneplus", "huawei",
    "nintendo", "playstation", "xbox", "figma", "trello", "bitwarden",
    "lastpass", "dashlane", "nordvpn", "expressvpn", "surfshark", "protonvpn",
    "hulu", "disneyplus", "primevideo", "hotstar", "crunchyroll", "lyft",
    "gojek", "careem", "upwork", "fiverr", "freelancer", "gcash", "gopay",
    "grabpay", "shopeepay", "tmobile", "vodafone", "airtel", "telenor", "zong",
    "ufone", "digicel", "etisalat", "mobily", "safaricom", "stc"
  ];

  // Cyrillic / Greek letters that visually look like Latin (homograph attacks)
  const HOMOGRAPH_CHARS = "аеросухіјѕгөҒαβγδεορστυχηκμν";

  // Leet-speak digit substitution used by scammers: g00gle, paypa1, amaz0n
  const LEET_MAP = { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "6": "g", "7": "t", "8": "b", "9": "g" };

  function deleet(str) {
    let out = str;
    for (const k in LEET_MAP) out = out.split(k).join(LEET_MAP[k]);
    return out;
  }

  function hasPunycode(hostname) {
    const labels = hostname.split(".");
    for (let i = 0; i < labels.length; i++) {
      if (labels[i].indexOf("xn--") === 0) return true;
    }
    return false;
  }

  // Danger levels per sensitivity (low / medium / high)
  const THRESHOLDS = {
    low:    { danger: 70, caution: 45 },
    medium: { danger: 55, caution: 30 },
    high:   { danger: 40, caution: 20 }
  };

  function extractHostname(rawUrl) {
    try {
      return new URL(rawUrl).hostname.toLowerCase();
    } catch (e) {
      return "";
    }
  }

  function isIpAddress(hostname) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || /^[0-9a-f:]{2,}:/.test(hostname);
  }

  function containsHomograph(hostname) {
    for (let i = 0; i < hostname.length; i++) {
      if (HOMOGRAPH_CHARS.indexOf(hostname[i]) !== -1) return true;
    }
    return false;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (a.length < b.length) return levenshtein(b, a);
    if (b.length === 0) return a.length;
    let prev = new Array(b.length + 1);
    let curr = new Array(b.length + 1);
    for (let i = 0; i <= b.length; i++) prev[i] = i;
    for (let i = 1; i <= a.length; i++) {
      curr[0] = i;
      for (let j = 1; j <= b.length; j++) {
        curr[j] = Math.min(
          prev[j] + 1,
          curr[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      const t = prev; prev = curr; curr = t;
    }
    return prev[b.length];
  }

  function findSuspiciousTld(hostname) {
    const last = hostname.lastIndexOf(".");
    if (last === -1) return null;
    const tld = hostname.slice(last + 1);
    return SUSPICIOUS_TLDS.has(tld) ? "." + tld : null;
  }

  // Find a brand inside any hostname label (catches paypal.com.xyz, google-login.site, g00gle-verify.top)
  function findBrand(hostname) {
    const labels = hostname.split(".");
    for (let i = 0; i < labels.length; i++) {
      const clean = labels[i].replace(/[^a-z0-9]/g, "");
      if (!clean) continue;
      const clean2 = deleet(clean);
      for (let j = 0; j < BRANDS.length; j++) {
        const b = BRANDS[j];
        if (clean === b || clean2 === b) {
          return { brand: b, type: clean === b ? "exact" : "leetspeak", label: clean };
        }
      }
      for (let j = 0; j < BRANDS.length; j++) {
        const b = BRANDS[j];
        if ((clean.length > b.length && clean.indexOf(b) !== -1) ||
            (clean2.length > b.length && clean2.indexOf(b) !== -1)) {
          return { brand: b, type: "embedded", label: clean };
        }
      }
      if (clean2.length >= 5 && clean2.length <= 12) {
        for (let j = 0; j < BRANDS.length; j++) {
          const b = BRANDS[j];
          if (Math.abs(clean2.length - b.length) <= 2 && levenshtein(clean2, b) <= 2) {
            return { brand: b, type: "typo", label: clean };
          }
        }
      }
    }
    return null;
  }

  function isRealBrandDomain(hostname, brandHit) {
    if (!brandHit || brandHit.type !== "exact") return false;
    if (findSuspiciousTld(hostname)) return false;
    const labels = hostname.split(".");
    // the exact brand must be the second-level label of a normal domain: brand.com
    const top = labels[labels.length - 1];
    const second = labels.length >= 2 ? labels[labels.length - 2] : "";
    return SECOND_LEVEL_TLDS.has(top) && second === brandHit.label;
  }

  function prettyBrand(brand) {
    const map = {
      google: "Google", gmail: "Gmail", facebook: "Facebook", instagram: "Instagram",
      whatsapp: "WhatsApp", netflix: "Netflix", amazon: "Amazon", paypal: "PayPal",
      apple: "Apple", icloud: "iCloud", microsoft: "Microsoft", outlook: "Outlook",
      yahoo: "Yahoo", ebay: "eBay", bankofamerica: "Bank of America",
      payoneer: "Payoneer", coinbase: "Coinbase", binance: "Binance",
      linkedin: "LinkedIn", telegram: "Telegram", spotify: "Spotify",
      dropbox: "Dropbox", mcafee: "McAfee", norton: "Norton", hdfcbank: "HDFC Bank",
      jazzcash: "JazzCash", easypaisa: "EasyPaisa", bkash: "bKash", nagad: "Nagad"
    };
    return map[brand] || brand.charAt(0).toUpperCase() + brand.slice(1);
  }

  function analyzeUrl(rawUrl, sensitivity) {
    const th = THRESHOLDS[sensitivity] || THRESHOLDS.medium;
    const reasons = [];
    let score = 0;
    let hostname = "";

    try {
      const parsed = new URL(rawUrl);
      hostname = parsed.hostname.toLowerCase();
      const path = (parsed.pathname || "").toLowerCase();

      // 1. '@' trick: realbank.com@evil.site
      if (rawUrl.indexOf("@") !== -1) {
        score += 70;
        reasons.push("The URL contains an '@' symbol, a well-known phishing trick.");
      }

      // 2. IP instead of domain
      const isIp = isIpAddress(hostname);
      if (isIp) {
        score += 40;
        reasons.push("The site address is an IP number instead of a real domain name.");
      }

      // 3. Homograph characters (looks English, is not)
      if (containsHomograph(hostname)) {
        score += 65;
        reasons.push("The domain uses non-English characters that look like English - this can be a lookalike site.");
      }

      // 3b. Punycode (xn--) international domains - common in homograph scams
      const isPunycode = hasPunycode(hostname);
      const suspiciousTld = findSuspiciousTld(hostname);
      const brandHit = findBrand(hostname);
      let brandLabel = brandHit ? prettyBrand(brandHit.brand) : "";

      if (isPunycode) {
        score += 25;
        reasons.push("The domain uses non-English (punycode) characters.");
        if (suspiciousTld) {
          score += 35;
          reasons.push("An international (xn--) domain is using a suspicious extension (." + suspiciousTld.slice(1) + ").");
        }
        if (brandHit) score += 40;
      }

      // 4. Brand matching
      if (brandHit) {
        if (suspiciousTld) {
          score += 75;
          reasons.push("'" + brandLabel + "' name is used on a suspicious domain (." + suspiciousTld.slice(1) + ") - a common fake site pattern.");
        } else if (brandHit.type === "embedded") {
          score += 60;
          reasons.push("The domain '" + hostname + "' hides the name '" + brandLabel + "' to trick you.");
        } else if (brandHit.type === "typo") {
          score += 65;
          reasons.push("The domain '" + hostname + "' looks similar to '" + brandLabel + "' - it may be fake.");
        } else if (brandHit.type === "leetspeak") {
          score += 65;
          reasons.push("The domain '" + hostname + "' uses numbers to look like '" + brandLabel + "' - it is likely fake.");
        }
      } else if (suspiciousTld && suspiciousTld === ".zip") {
        // new dangerous TLDs are extra suspicious
        score += 45;
        reasons.push("The site uses a new and risky domain extension ('.zip'), often used for scams.");
      }

      // 5. Keywords inside the registrable domain (no brand match)
      if (!brandHit) {
        for (let i = 0; i < SUSPICIOUS_KEYWORDS.length; i++) {
          if (hostname.indexOf(SUSPICIOUS_KEYWORDS[i]) !== -1) {
            score += 45;
            reasons.push("The domain contains the word '" + SUSPICIOUS_KEYWORDS[i] + "' - fake sites often use this word.");
            break;
          }
        }
      }

      // 6. Brand + login keywords in path on a non-brand domain
      if (!brandHit) {
        let pathBrand = null;
        for (let i = 0; i < BRANDS.length; i++) {
          if (path.indexOf(BRANDS[i]) !== -1) { pathBrand = BRANDS[i]; break; }
        }
        let pathKeywordCount = 0;
        for (let i = 0; i < SUSPICIOUS_KEYWORDS.length; i++) {
          if (path.indexOf(SUSPICIOUS_KEYWORDS[i]) !== -1) pathKeywordCount++;
        }
        if (pathBrand || pathKeywordCount >= 2) {
          score += 55;
          reasons.push("The page address contains " +
            (pathBrand ? ("'" + prettyBrand(pathBrand) + "'") : "words like 'login' or 'verify'") +
            ", but this does not look like the real brand site.");
        }
      }

      // 7. Suspicious structure
      if (hostname.split(".").length >= 5) {
        score += 20;
        reasons.push("The website address is very complicated.");
      }
      if ((hostname.match(/-/g) || []).length >= 3) {
        score += 20;
        reasons.push("The domain has too many '-' symbols - a common fake site pattern.");
      }
      if (hostname.length >= 50) {
        score += 20;
        reasons.push("The domain name is very long.");
      }

      // 8. Real brand domain (e.g. paypal.com, amazon.co.uk) => always safe
      if (isRealBrandDomain(hostname, brandHit)) {
        return { score: 0, verdict: "safe", reasons: [], hostname: hostname };
      }
    } catch (e) {
      return { score: 0, verdict: "safe", reasons: [], hostname: "" };
    }

    let verdict = "safe";
    if (score >= th.danger) verdict = "danger";
    else if (score >= th.caution) verdict = "caution";

    return { score: score, verdict: verdict, reasons: reasons, hostname: hostname };
  }

  root.ScamGuardDetector = {
    analyzeUrl: analyzeUrl,
    THRESHOLDS: THRESHOLDS
  };
})(typeof self !== "undefined" ? self : this);
