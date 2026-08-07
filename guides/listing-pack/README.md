# Scam Guard - Store Listing Pack

Upload se pehle yeh pack dekhein. Har file copy-paste ready hai.

## Files

| File | Kahan use hoti hai |
| --- | --- |
| `chrome-listing.txt` | Chrome Web Store (name, description, permissions, privacy form) |
| `firefox-listing.txt` | Firefox Add-ons (name, summary, description, categories, tags) |
| `edge-listing.txt` | Microsoft Edge Add-ons (name, short/long description, permissions) |
| `privacy-policy.md` | Privacy Policy URL - ise kisi hosted page par paste karein |
| `permission-justification.md` | Permissions ka reason - reference ke liye |

## Images (assets\store\)

| File | Size | Kahan upload hoti hai |
| --- | --- | --- |
| `promo-440x280.png` | 440x280 | Chrome promotional tile |
| `screenshot-1-safe.png` | 1280x800 | Safe site (green) - sab stores |
| `screenshot-2-warning.png` | 1280x800 | Fake site warning (red) - sab stores |
| `screenshot-3-popup.png` | 1280x800 | Popup verdict - sab stores |

## Aapke account email (upload se pehle decide karein)

Ek email store listing me "support/developer contact" ke liye jayega.
Pichhe decide ho chuka hai ke ek Gmail hi sab accounts ke liye - wo yahan use karein.

## Publish order

1. **Firefox** (free, review 1-2 din) - `firefox-upload-guide.md`
2. **Edge** (free, review fast) - `edge-upload-guide.md`
3. **Chrome** ($5 one-time, review 2-5 din) - `chrome-upload-guide.md`

## Pre-publish checklist

- [ ] `node tools/build.mjs` chala kar naye zips bana lein (`dist\scamguard-v1.0.1-chrome.zip`, `dist\scamguard-v1.0.1-edge.zip`, `dist\scamguard-v1.0.1-firefox.zip`)
- [ ] `node tools/build.mjs` se 83/83 tests pass hoon (47 detector + 36 service-worker)
- [ ] Icons `assets\icons\` me maujood (16/32/48/128)
- [ ] Screenshots (3) `assets\store\` me maujood
- [ ] Promo `assets\store\promo-440x280.png` maujood
- [ ] Privacy Policy text `privacy-policy.md` se kisi page par paste kar ke URL ready
- [ ] Support email decide kar liya
- [ ] Firefox: `browser_specific_settings.gecko.id` manifest me hai (verify)

## Live hone ke baad

- Har store par 1-2 din me listing live honi chahiye (review ke baad)
- 2-4 hafte tak roz kisi ko install karwayein + genuine reviews lein
- Kisi user ko koi issue aaye to support email par jawab dena (rating 4.5+ ke liye)
