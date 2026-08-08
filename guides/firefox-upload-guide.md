# Firefox me Scam Guard upload karne ka guide (100% FREE)

Firefox par publish karna **bilkul free** hai - koi fee nahi, koi card nahi.

## Pehli dafa setup

1. **Firefox Add-ons Developer Hub** kholein:
   `https://addons.mozilla.org/developers/`
2. **Log in** karein (Mozilla account / email se).
3. Pehli dafa koi email verification aur basic details mang sakta hai - fill kar dein.

## Extension upload

1. Pehle build karein: `node tools/build.mjs` chala kar `dist\scamguard-v1.0.2-firefox.zip` bana lein.
2. Developer Hub me **"Submit a New Add-on"** par click karein.
3. **"Upload your file"** -> `scamguard-v1.0.2-firefox.zip` select karein.
4. **Distribution** choose karein: **"Self-distributed"** (pehle test ke liye) ya
   **"On this site"** (public listing) - final publish ke liye "On this site" chunein.
5. Listing form fill karein (help ke liye `seo-listing-guide.md` dekhein).
6. **Privacy Policy** ka link maangta hai - koi bhi simple page bana lein
   (jaise ek free GitHub page) jisme likha ho:
   *"Scam Guard koi data collect, store ya share nahi karta. Sab kuch browser ke andar chalta hai."*
7. Submit karein. Mozilla manually review karta hai (1-2 din lagein ge).

## Baad ki updates

- Naya build bana kar Developer Hub me **"New version"** -> zip upload -> submit.
- Firefox updates bina kisi fee ke hamesha free hain.

> Note: `manifest.json` me pehle se `browser_specific_settings.gecko.id` hai, is liye
> Firefox bina issue accept kar lega.
