# Scam Guard - Phishing & Fake Website Detector

A **free, private, cross-browser browser extension** that warns you before you
enter passwords or payment details on fake / phishing websites.

- **100% client-side** - no server, no tracking, no data ever leaves your browser
- **Cross-browser** - one codebase runs on Chrome, Edge, Firefox, Opera and Brave
- **Fast** - lightweight heuristic engine, in-memory caching, zero network calls
- **Easy to use** - one-click block / trust, sensitivity levels, backup & restore

---

## Features

- Detects lookalike brands (`paypal-secure-login.xyz`), typo domains (`paypa1.com`),
  leet-speak (`g00gle.com`), homograph / punycode domains and suspicious TLDs.
- Catches classic tricks: `@` in the URL, IP-address hosts, keyword-stuffed domains.
- Full-screen warning overlay before you can type anything.
- Popup with a clear safe / caution / danger status and reasons.
- Options page: toggles, sensitivity, blocked list, trusted list, export/import.
- Never flags real brand domains (`paypal.com`, `amazon.co.uk`, ...).

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
|   |-- test-detector.mjs      # detector self-test (22 test cases)
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

This runs the tests, copies the extension into `dist/`, minifies the code and
creates the store upload zips:
- `dist/scamguard-v1.0.1-chrome.zip`
- `dist/scamguard-v1.0.1-edge.zip`
- `dist/scamguard-v1.0.1-firefox.zip`

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

Scam Guard sends **nothing** anywhere. Detection runs entirely inside the
browser. Blocked / trusted lists are stored only in the browser's own storage
and can be exported/imported by the user.

## License

**Functional Source License (FSL-1.1-MIT)** - see `LICENSE`.

The source code is open for you to read, learn from and use non-commercially.
Making a competing commercial product from this code is not permitted. On the
second anniversary of each released version, that version becomes MIT-licensed
automatically.
