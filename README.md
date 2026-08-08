# Scam Guard - Phishing & Fake Website Detector

A **free, private, cross-browser browser extension** that warns you before you
enter passwords or payment details on fake / phishing websites.

- **Private by design** - no account, no tracking, no data uploaded. Detection
  runs inside your browser; only a public list of reported scam domains is
  downloaded automatically (can be turned off in settings)
- **Cross-browser** - one codebase runs on Chrome, Edge, Firefox, Opera and Brave
- **Fast** - lightweight heuristic engine, in-memory caching, cached live feed
- **Easy to use** - one-click block / trust, sensitivity levels, backup & restore

---

## Features

- Detects lookalike brands (`paypal-secure-login.xyz`), typo domains (`paypa1.com`),
  leet-speak (`g00gle.com`), homograph / punycode domains and suspicious TLDs.
- Catches classic tricks: `@`-in-URL attacks, IP-address hosts, keyword-stuffed domains.
- Official brand domains map: only real brand sites (e.g. `paypal.com`,
  `amazon.co.uk`, `login.microsoftonline.com`) are ever treated as safe - so
  `paypal.evil.com`, `paypal.com.evil.com` and `paypal.ai` are flagged as fakes.
- Full-screen warning overlay before you can type anything.
- Popup with a clear safe / caution / danger status and reasons.
- Options page: toggles, sensitivity, blocked list, trusted list, export/import.
- Never flags real brand domains (exact hostname/suffix validation only).

## How detection works (what the extension reads)

- **Live phishing feed** - Scam Guard downloads a public domain-only blacklist
  (CERT.PL) roughly twice a day and matches the *hostname* of the page you are
  on against it. Only the domain list is downloaded - no URL, no browsing data
  and no personal information is ever sent. Legitimate domains (brand sites and
  the roots of shared hosting platforms) are filtered out and can never enter
  the feed.
- **Local inspection** - on the page itself the extension reads links, forms and
  input fields (password/card fields) to warn you about suspicious behaviour.
  All of this happens locally inside the browser.

---

## Project structure

```
ExtenstionsProject/
|-- manifest.json              # MV3 manifest (i18n name/description for SEO)
|-- _locales/en/messages.json  # Store SEO text
|-- assets/
|   |-- icons/                 # icon16/32/48/128
|   `-- store/                 # promo banner + screenshots for the stores
|-- src/
|   |-- detector/detector.js   # the detection engine (pure JS, unit-tested)
|   |-- background/            # service worker (caching, blocklist, settings)
|   |-- content/               # warning overlay (CSS + injector)
|   |-- popup/                 # toolbar popup UI
|   `-- options/               # settings / blocklist manager
|-- tools/
|   |-- generate-assets.ps1    # regenerates icons + store art
|   |-- test-detector.mjs      # detector self-test (59 regression cases)
|   `-- build.mjs              # production build: test -> copy -> minify -> zip
|-- guides/                    # step-by-step store upload guides
`-- build.bat                  # double-click to build (Windows)
```

---

## Test the extension (before publishing)

1. Open your browser. Select **Load unpacked**:
   - **Chrome / Edge / Brave / Opera**: `chrome://extensions` (or
     `edge://extensions`) → enable *Developer mode* → **Load unpacked** →
     choose this `ExtenstionsProject` folder.
   - **Firefox**: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** →
     choose `manifest.json`.
2. Open `https://paypal.com` -> should be **safe**.
3. Open `https://paypal-secure-login.xyz` -> a **red warning overlay** should appear.

Run the engine tests anytime:

```
node tools/test-detector.mjs
```

---

## Build the store package

Run:

```
node tools/build.mjs
```

This runs the tests (against the source AND the minified build), copies the
extension into `dist/`, minifies the code and creates the store upload zips:
- `dist/scamguard-v1.0.2-chrome.zip`
- `dist/scamguard-v1.0.2-edge.zip`
- `dist/scamguard-v1.0.2-firefox.zip`
- `dist/scamguard-v1.0.2-opera.zip`

---

## Publish (quick links)

| Store | Guide | Cost |
| --- | --- | --- |
| Firefox Add-ons | `guides/firefox-upload-guide.md` | Free |
| Edge Add-ons | `guides/edge-upload-guide.md` | Free |
| Chrome Web Store | `guides/chrome-upload-guide.md` | $5 one-time |
| SEO listing tips | `guides/seo-listing-guide.md` | - |

---

## Privacy

Scam Guard uploads **nothing** about you. Detection runs inside the browser and
reads page links, forms and input fields locally. The only network connection is
downloading a public, domain-only list of reported scam domains (CERT.PL) a
couple of times a day - you can turn this off in settings at any time. Blocked /
trusted lists are stored only in the browser's own storage and can be
exported/imported by the user. See `guides/listing-pack/privacy-policy.md`.

## License

**Functional Source License (FSL-1.1-MIT)** - see `LICENSE`.

The source code is open for you to read, learn from and use non-commercially.
Making a competing commercial product from this code is not permitted. On the
second anniversary of each released version, that version becomes MIT-licensed
automatically.
