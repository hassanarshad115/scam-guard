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

  const SUSPICIOUS_KEYWORDS = [
    "login", "signin", "sign-in", "verify", "verification", "secure", "account",
    "update", "confirm", "wallet", "withdraw", "bonus", "prize", "lottery",
    "refund", "support", "banking", "netbank", "password", "recover", "unlock",
    "gift-card", "invoice", "billing", "identity", "kyc", "otp", "free-gift"
  ];

  // "Paid to view" ad redirectors - these hide the real destination behind ad
  // pages and are frequently used to deliver scam or malware content.
  const SHADY_REDIRECTORS = new Set([
    "adf.ly", "ouo.io", "shorte.st", "sh.st", "adfoc.us", "bc.vc", "n9.cl",
    "1t.ag", "2.gp", "exe.io", "shiia.net", "sub2unlock.net", "coinlink.co",
    "shortzon.com", "linkly.site", "tny.sh", "ssls.pw"
  ]);

  // Popular link shorteners - the real destination is hidden behind a redirect.
  const LINK_SHORTENERS = new Set([
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly", "ow.ly",
    "rebrand.ly", "tiny.cc", "rb.gy", "buff.ly", "shorturl.at", "t.ly",
    "bl.ink", "tr.im", "v.gd", "qr.ae", "u.to", "chot.li", "tny.im"
  ]);

  // Official registrable domains per brand. A page is only treated as the real
  // brand website when its hostname EXACTLY equals one of these domains or is a
  // subdomain of one (e.g. login.microsoftonline.com ends with .microsoftonline.com).
  // Everything else that merely contains a brand label is treated as a fake.
  const GLOBAL_CC = [
    "com", "co.uk", "de", "fr", "it", "es", "nl", "se", "pl", "no", "dk", "fi",
    "ca", "com.au", "co.in", "com.pk", "com.br", "com.mx", "com.tr", "co.jp",
    "co.kr", "com.sg", "com.my", "co.id", "com.hk", "com.tw", "co.th", "com.vn",
    "com.ph", "ae", "com.sa", "com.eg", "com.ng", "co.za", "com.ar", "cl",
    "com.pe", "co.il", "ro", "gr", "pt", "be", "at", "ch", "cz", "ie", "com.co",
    "com.ua", "co.nz"
  ];

  function cc(brand) {
    const out = [];
    for (let i = 0; i < GLOBAL_CC.length; i++) out.push(brand + "." + GLOBAL_CC[i]);
    return out;
  }

  const BRAND_DOMAINS = {
    google: cc("google").concat([
      "google.com", "google.co", "google.pk", "gmail.com", "googlemail.com",
      "youtube.com", "googleusercontent.com", "googleapis.com", "googlevideo.com",
      "googleadservices.com", "goo.gl", "android.com", "googleblog.com"
    ]),
    gmail: ["gmail.com", "googlemail.com"],
    youtube: ["youtube.com", "youtu.be"],
    facebook: cc("facebook").concat(["facebook.com", "fb.com", "fb.me", "messenger.com", "facebook.net"]),
    instagram: ["instagram.com"],
    whatsapp: ["whatsapp.com", "whatsapp.net", "wa.me"],
    netflix: ["netflix.com", "netflix.net", "netflix.ca", "netflix.co.uk", "netflix.com.au",
      "netflix.de", "netflix.fr", "netflix.co.jp", "netflix.com.br", "netflix.com.mx",
      "netflix.in", "netflix.co.kr", "netflix.com.hk", "netflix.com.sg", "netflix.com.tr"],
    amazon: cc("amazon").concat([
      "amazon.com", "amazon.in", "amazon.sg", "amazon.ae", "amazon.sa", "amazon.eg",
      "amazon.co.jp", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.ca",
      "amazon.com.au", "amazon.com.br", "amazon.com.mx", "amazon.com.tr", "amazon.it",
      "amazon.es", "amazon.nl", "amazon.se", "amazon.pl", "amazon.aws", "amazonpay.com",
      "amazonaws.com"
    ]),
    paypal: cc("paypal").concat([
      "paypal.com", "paypal.me", "paypal-mobile.com", "paypal-community.com",
      "paypal-software.com", "paypalobjects.com"
    ]),
    apple: cc("apple").concat(["apple.com", "icloud.com", "me.com", "mac.com", "apple.co"]),
    icloud: ["icloud.com", "me.com", "mac.com"],
    microsoft: cc("microsoft").concat([
      "microsoft.com", "microsoftonline.com", "live.com", "outlook.com", "office.com",
      "office365.com", "office.net", "onedrive.com", "sharepoint.com", "xbox.com",
      "bing.com", "msn.com", "windows.com", "microsoftstore.com", "azure.com"
    ]),
    outlook: ["outlook.com", "live.com", "office.com", "microsoftonline.com"],
    office365: ["office365.com", "office.com", "microsoftonline.com"],
    yahoo: ["yahoo.com", "yahoo.co.uk", "yahoo.de", "yahoo.fr", "yahoo.co.jp", "yahoo.co.in",
      "yahoo.ca", "yahoo.com.au", "yahoo.com.br", "yahoo.com.sg", "yahoo.com.my",
      "yahoo.co.id", "yahoo.com.tw", "yahoo.co.kr", "yahoo.co.th", "yahoo.com.vn",
      "yahoo.com.ph", "yahoo.co.nz", "yahoo.it", "yahoo.es", "yahoo.com.hk"],
    ebay: ["ebay.com", "ebay.co.uk", "ebay.de", "ebay.fr", "ebay.it", "ebay.es",
      "ebay.com.au", "ebay.ca", "ebay.com.my", "ebay.com.sg", "ebay.ph", "ebay.in",
      "ebay.be", "ebay.at", "ebay.ch", "ebay.nl", "ebay.ie", "ebay.com.hk",
      "ebay.com.tw", "ebay-kleinanzeigen.de", "ebay.co.jp"],
    chase: ["chase.com"],
    bankofamerica: ["bankofamerica.com"],
    wellsfargo: ["wellsfargo.com"],
    citi: ["citi.com", "citibank.com", "citibank.com.sg", "citibank.com.my", "citibank.com.hk",
      "citibank.co.in", "citibank.com.au", "citibank.com.br", "citibank.com.mx",
      "citibank.com.ph", "citibank.co.id", "citibank.com.tr", "citibank.com.pl"],
    hsbc: ["hsbc.com", "hsbc.co.uk", "hsbc.com.hk", "hsbc.ca", "hsbc.com.sg", "hsbc.com.my",
      "hsbc.co.in", "hsbc.com.au", "hsbc.fr", "hsbc.com.br", "hsbc.com.mx", "hsbc.com.tr",
      "hsbc.com.ph", "hsbc.co.th", "hsbc.com.tw", "hsbc.ae", "hsbc.com.sa", "hsbc.co.id",
      "hsbc.com.pk", "hsbc.com.bd", "hsbc.com.eg", "hsbc.com.pl"],
    barclays: ["barclays.co.uk", "barclays.com"],
    bitcoin: ["bitcoin.org", "bitcoin.com"],
    coinbase: ["coinbase.com"],
    binance: ["binance.com"],
    payoneer: ["payoneer.com"],
    wise: ["wise.com", "transferwise.com"],
    skype: ["skype.com"],
    linkedin: ["linkedin.com"],
    twitter: ["twitter.com", "x.com", "t.co"],
    telegram: ["telegram.org", "t.me"],
    steam: ["steampowered.com", "steamcommunity.com"],
    epicgames: ["epicgames.com"],
    spotify: ["spotify.com"],
    dropbox: ["dropbox.com", "dropboxusercontent.com"],
    mcafee: ["mcafee.com"],
    norton: ["norton.com", "nortonlifelock.com"],
    godaddy: ["godaddy.com"],
    canva: ["canva.com"],
    adobe: ["adobe.com", "adobe.io"],
    tiktok: ["tiktok.com", "tiktokv.com"],
    snapchat: ["snapchat.com"],
    reddit: ["reddit.com", "redditmedia.com", "redditstatic.com", "redd.it"],
    roblox: ["roblox.com"],
    airbnb: ["airbnb.com"],
    uber: ["uber.com"],
    samsung: ["samsung.com"],
    xiaomi: ["xiaomi.com", "mi.com"],
    sbi: ["sbi.co.in", "onlinesbi.com", "onlinesbi.sbi"],
    hdfcbank: ["hdfcbank.com"],
    icicibank: ["icicibank.com"],
    kotak: ["kotak.com"],
    axisbank: ["axisbank.com"],
    bmo: ["bmo.com"],
    rbc: ["rbcroyalbank.com"],
    tdbank: ["td.com", "tdbank.com"],
    revolut: ["revolut.com"],
    amex: ["americanexpress.com"],
    visa: ["visa.com"],
    mastercard: ["mastercard.com"],
    irctc: ["irctc.co.in"],
    nagad: ["nagad.com.bd"],
    bkash: ["bkash.com"],
    jazzcash: ["jazzcash.com.pk", "jazz.com.pk", "jazz.pk"],
    easypaisa: ["easypaisa.com.pk"],
    paytm: ["paytm.com"],
    phonepe: ["phonepe.com"],
    gpay: ["gpay.app"],
    razorpay: ["razorpay.com"],
    stripe: ["stripe.com"],
    zelle: ["zelle.com"],
    venmo: ["venmo.com"],
    cashapp: ["cash.app", "squareup.com"],
    westernunion: ["westernunion.com"],
    moneygram: ["moneygram.com"],
    worldremit: ["worldremit.com"],
    metamask: ["metamask.io"],
    ledger: ["ledger.com"],
    trezor: ["trezor.io"],
    trustwallet: ["trustwallet.com"],
    phantom: ["phantom.app"],
    exodus: ["exodus.com"],
    bybit: ["bybit.com"],
    okx: ["okx.com"],
    kucoin: ["kucoin.com"],
    kraken: ["kraken.com"],
    robinhood: ["robinhood.com"],
    etrade: ["etrade.com"],
    etoro: ["etoro.com"],
    schwab: ["schwab.com"],
    vanguard: ["vanguard.com"],
    capitalone: ["capitalone.com"],
    usbank: ["usbank.com"],
    pnc: ["pnc.com"],
    santander: ["santander.com", "santander.co.uk", "santander.es", "santander.com.mx", "santander.com.br"],
    bbva: ["bbva.com", "bbva.es", "bbva.mx", "bbva.com.mx", "bbva.com.pe", "bbva.com.ar",
      "bbva.com.co", "bbva.com.uy", "bbva.com.ve"],
    lloyds: ["lloydsbank.com", "lloydsbank.co.uk"],
    natwest: ["natwest.com", "natwest.co.uk"],
    halifax: ["halifax.co.uk"],
    nationwide: ["nationwide.co.uk"],
    monzo: ["monzo.com"],
    n26: ["n26.com"],
    dbs: ["dbs.com"],
    maybank: ["maybank.com", "maybank.com.my"],
    ocbc: ["ocbc.com"],
    cimb: ["cimb.com", "cimb.com.my", "cimbbank.com"],
    itau: ["itau.com.br", "itau.com"],
    nubank: ["nubank.com.br"],
    bradesco: ["bradesco.com.br"],
    yesbank: ["yesbank.in"],
    bankofbaroda: ["bankofbaroda.in"],
    adyen: ["adyen.com"],
    klarna: ["klarna.com"],
    afterpay: ["afterpay.com"],
    remitly: ["remitly.com"],
    fedex: ["fedex.com"],
    usps: ["usps.com"],
    dhl: ["dhl.com"],
    royalmail: ["royalmail.com"],
    postoffice: ["postoffice.co.uk"],
    swiggy: ["swiggy.com"],
    zomato: ["zomato.com"],
    dominos: ["dominos.com", "dominos.com.pk", "dominos.co.in", "dominos.co.uk"],
    pizzahut: ["pizzahut.com"],
    starbucks: ["starbucks.com"],
    burgerking: ["bk.com", "burgerking.com"],
    flipkart: ["flipkart.com"],
    myntra: ["myntra.com"],
    meesho: ["meesho.com"],
    bigbasket: ["bigbasket.com"],
    zepto: ["zepto.app", "zepto.com"],
    blinkit: ["blinkit.com"],
    ajio: ["ajio.com"],
    nykaa: ["nykaa.com"],
    shopee: ["shopee.com", "shopee.com.my", "shopee.sg", "shopee.co.id", "shopee.co.th",
      "shopee.ph", "shopee.com.ph", "shopee.vn", "shopee.com.br", "shopee.co.in", "shopee.com.tw"],
    lazada: ["lazada.com", "lazada.sg", "lazada.com.my", "lazada.co.th", "lazada.com.ph",
      "lazada.vn", "lazada.co.id"],
    aliexpress: ["aliexpress.com", "alibaba.com"],
    temu: ["temu.com"],
    etsy: ["etsy.com"],
    shein: ["shein.com", "shein.co.uk", "shein.com.pk", "shein.com.mx", "shein.com.br", "shein.com.au"],
    delhivery: ["delhivery.com"],
    bluedart: ["bluedart.com"],
    discord: ["discord.com", "discordapp.com", "discord.gg"],
    twitch: ["twitch.tv"],
    fortnite: ["fortnite.com", "epicgames.com"],
    riotgames: ["riotgames.com"],
    minecraft: ["minecraft.net"],
    pinterest: ["pinterest.com", "pin.it"],
    quora: ["quora.com"],
    tinder: ["tinder.com"],
    patreon: ["patreon.com"],
    kickstarter: ["kickstarter.com"],
    zalando: ["zalando.de", "zalando.com", "zalando.fr", "zalando.co.uk", "zalando.it", "zalando.es"],
    nike: ["nike.com"],
    adidas: ["adidas.com", "adidas.de", "adidas.co.uk"],
    oneplus: ["oneplus.com"],
    huawei: ["huawei.com"],
    nintendo: ["nintendo.com"],
    playstation: ["playstation.com"],
    xbox: ["xbox.com"],
    figma: ["figma.com"],
    trello: ["trello.com"],
    bitwarden: ["bitwarden.com"],
    lastpass: ["lastpass.com"],
    dashlane: ["dashlane.com"],
    nordvpn: ["nordvpn.com"],
    expressvpn: ["expressvpn.com"],
    surfshark: ["surfshark.com"],
    protonvpn: ["protonvpn.com"],
    hulu: ["hulu.com"],
    disneyplus: ["disneyplus.com", "disney.com"],
    primevideo: ["primevideo.com"],
    hotstar: ["hotstar.com"],
    crunchyroll: ["crunchyroll.com"],
    lyft: ["lyft.com"],
    gojek: ["gojek.io", "gojek.com"],
    careem: ["careem.com"],
    upwork: ["upwork.com"],
    fiverr: ["fiverr.com"],
    freelancer: ["freelancer.com"],
    gcash: ["gcash.com"],
    gopay: ["gopay.co.id"],
    grabpay: ["grab.com"],
    shopeepay: ["shopeepay.com.ph"],
    tmobile: ["t-mobile.com", "t-mobile.co.uk", "tmobile.com"],
    vodafone: ["vodafone.com", "vodafone.co.uk", "vodafone.de", "vodafone.in", "vodafone.it",
      "vodafone.es", "vodafone.com.tr", "vodafone.com.eg"],
    airtel: ["airtel.in", "airtel.com"],
    telenor: ["telenor.com", "telenor.pk", "telenor.no", "telenor.dk", "telenor.se", "telenor.bg"],
    zong: ["zong.com.pk"],
    ufone: ["ufone.com"],
    digicel: ["digicel.com"],
    etisalat: ["etisalat.ae", "etisalat.com"],
    mobily: ["mobily.com.sa"],
    safaricom: ["safaricom.co.ke"],
    stc: ["stc.com.sa"]
  };

  const BRAND_NAMES = Object.keys(BRAND_DOMAINS);

  // Flat set of every official brand domain for cheap protected-domain lookups.
  const OFFICIAL_DOMAINS = new Set();
  for (const brand in BRAND_DOMAINS) {
    for (let i = 0; i < BRAND_DOMAINS[brand].length; i++) {
      OFFICIAL_DOMAINS.add(BRAND_DOMAINS[brand][i]);
    }
  }

  // Shared-hosting / dev platforms whose ROOT domain must never be blocked by the
  // live feed (blocking the root would take down thousands of unrelated sites).
  // Subdomains of these platforms ARE still blocked (they are user-controlled).
  const PLATFORM_DOMAINS = new Set([
    "github.com", "github.io", "gitlab.com", "gitlab.io", "bitbucket.org",
    "dropbox.com", "dropboxusercontent.com", "vercel.app", "netlify.app",
    "herokuapp.com", "render.com", "pages.dev", "firebaseapp.com", "web.app",
    "azurewebsites.net", "cloudapp.net", "cloudfront.net", "amazonaws.com",
    "s3.amazonaws.com", "weebly.com", "wixsite.com", "wix.com", "wordpress.com",
    "blogspot.com", "blogger.com", "tumblr.com", "medium.com", "substack.com",
    "ghost.io", "squarespace.com", "webflow.io", "godaddysites.com", "site123.me",
    "jimdo.com", "yolasite.com", "strikingly.com", "carrd.co", "about.me",
    "notion.site", "wikipedia.org", "wikimedia.org", "archive.org",
    "google.com", "googleusercontent.com", "googleapis.com", "cloudflare.com",
    "googlesyndication.com", "doubleclick.net", "jsdelivr.net", "codeberg.org",
    "sourceforge.net", "000webhostapp.com", "infinityfreeapp.com", "x10.mx"
  ]);

  // Sites where brand names are discussed in article/path text (wikipedia.org/wiki/PayPal).
  // Path-based brand matching must never fire on these - it only signals fakes.
  const TRUSTED_PUBLIC_SITES = new Set([
    "wikipedia.org", "wikimedia.org", "archive.org", "reddit.com", "quora.com",
    "medium.com", "stackoverflow.com", "stackexchange.com", "superuser.com",
    "serverfault.com", "github.com", "github.io", "gitlab.com", "bitbucket.org",
    "wordpress.com", "blogspot.com", "tumblr.com", "notion.site", "youtube.com",
    "w3.org", "mozilla.org"
  ]);

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
      for (let j = 0; j < BRAND_NAMES.length; j++) {
        const b = BRAND_NAMES[j];
        if (clean === b || clean2 === b) {
          return { brand: b, type: clean === b ? "exact" : "leetspeak", label: clean };
        }
      }
      for (let j = 0; j < BRAND_NAMES.length; j++) {
        const b = BRAND_NAMES[j];
        if ((clean.length > b.length && clean.indexOf(b) !== -1) ||
            (clean2.length > b.length && clean2.indexOf(b) !== -1)) {
          return { brand: b, type: "embedded", label: clean };
        }
      }
      if (clean2.length >= 5 && clean2.length <= 12) {
        for (let j = 0; j < BRAND_NAMES.length; j++) {
          const b = BRAND_NAMES[j];
          if (Math.abs(clean2.length - b.length) <= 2 && levenshtein(clean2, b) <= 2) {
            return { brand: b, type: "typo", label: clean };
          }
        }
      }
    }
    return null;
  }

  // Only a hostname that is exactly an official brand domain, or a subdomain of
  // one, is the real brand website. paypal.ai, paypal.evil.com and
  // paypal.com.evil.com are NOT official and are therefore treated as fakes.
  function isRealBrandDomain(hostname, brandHit) {
    if (!brandHit) return false;
    if (findSuspiciousTld(hostname)) return false;
    const official = BRAND_DOMAINS[brandHit.brand];
    if (!official) return false;
    for (let i = 0; i < official.length; i++) {
      const d = official[i];
      if (hostname === d || hostname.endsWith("." + d)) return true;
    }
    return false;
  }

  function isTrustedPublicSite(hostname) {
    for (const d of TRUSTED_PUBLIC_SITES) {
      if (hostname === d || hostname.endsWith("." + d)) return true;
    }
    return false;
  }

  // Used by the live-feed pipeline so legitimate domains (brand sites and the
  // roots of shared hosting platforms) can never enter the blocklist.
  function isProtectedDomain(hostname) {
    if (!hostname) return true;
    const h = String(hostname).toLowerCase();
    if (PLATFORM_DOMAINS.has(h)) return true;
    for (const d of OFFICIAL_DOMAINS) {
      if (h === d || h.endsWith("." + d)) return true;
    }
    return false;
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

      // 1. '@' trick: realbank.com@evil.site - only a real username/password in
      //    the authority means this, never an '@' that appears in the query/path
      //    (e.g. email addresses like ?email=user@example.com are safe).
      if (parsed.username !== "" || parsed.password !== "") {
        score += 70;
        reasons.push("The URL contains an '@' trick - the real address is '" + hostname + "', not the name before the '@'.");
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
        } else {
          // exact brand label on a domain that is NOT one of the official brand
          // domains (paypal.evil.com, paypal.com.evil.com, paypal.ai, ...)
          score += 70;
          reasons.push("The domain '" + hostname + "' uses the name '" + brandLabel + "' but is not the real '" + brandLabel + "' website.");
        }
      } else if (suspiciousTld && suspiciousTld === ".zip") {
        // new dangerous TLDs are extra suspicious
        score += 45;
        reasons.push("The site uses a new and risky domain extension ('.zip'), often used for scams.");
      }

      // 4b. Redirect / link-shortener services
      let hostNoWww = hostname;
      if (hostNoWww.indexOf("www.") === 0) hostNoWww = hostNoWww.slice(4);
      if (SHADY_REDIRECTORS.has(hostNoWww)) {
        score += 70;
        reasons.push("This link uses a paid redirection service that hides the real website - scam pages are often hidden behind these links.");
      } else if (LINK_SHORTENERS.has(hostNoWww)) {
        score += 35;
        reasons.push("This link is shortened - the real destination is hidden, check carefully before opening it.");
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

      // 6. Brand + login keywords in path on a non-brand domain.
      //    Never fires on trusted public sites where brands are discussed
      //    (wikipedia.org/wiki/PayPal must stay safe).
      if (!brandHit && !isTrustedPublicSite(hostname)) {
        let pathBrand = null;
        for (let i = 0; i < BRAND_NAMES.length; i++) {
          if (path.indexOf(BRAND_NAMES[i]) !== -1) { pathBrand = BRAND_NAMES[i]; break; }
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
    THRESHOLDS: THRESHOLDS,
    BRAND_DOMAINS: BRAND_DOMAINS,
    isProtectedDomain: isProtectedDomain
  };
})(typeof self !== "undefined" ? self : this);
