# Microsoft Edge me Scam Guard upload karne ka guide (100% FREE)

Edge par publish karna **bilkul free** hai.

## Account banae

1. **Edge Add-ons Developer** kholein:
   `https://developer.microsoft.com/microsoft-edge/extensions`
2. **"Get started"** par click karein -> **Partner Center** khulega.
3. Microsoft account se login karein (Outlook/Hotmail/GitHub account kaam karega).
4. **Account type** choose karein:
   - **Individual** - aap apne naam par (fast, minutes me verify)
   - **Company** - apni agency ke naam par (verification 2-3 hafte lagte hain)
5. Form fill kar ke **"Finish"** karein.

## Extension submit

1. Build karein: `node tools/build.mjs` -> `dist\scamguard-v1.0.2-edge.zip`.
2. Partner Center me **"Create a new extension"** karein.
3. Zip upload karein aur listing details bharein
   (copy-paste text ke liye `seo-listing-guide.md` dekhein).
4. **Privacy policy** ka link chahiye - simple page par ye likhein:
   *"Scam Guard koi data collect, store ya share nahi karta. Sab kuch browser ke andar chalta hai."*
5. Submit -> Microsoft certifies karta hai (aam taur par 24-72 ghante).

## Note (important)

Edge ko lagbhag same zip chalta hai jo Chrome ke liye hai, lekin Edge store
**apni alag review** karta hai. Kabhi kabhi Edge ke listing me thora sa alag
description chahiye hota hai - wo form me hi mil jata hai.

## Updates

**"Create new submission"** -> naya zip upload -> submit. Free.

## Updates via API (optional, faster)

Product ID aur API key chahiye:

1. **Product ID** (addonId): Partner Center -> **Microsoft Edge** -> extension
   open karo -> **Product ID** copy karo (Address bar me `microsoftedge/` aur
   `/packages` ke beech wala GUID).
2. **Client ID + API key**: Partner Center me API key management se bane the
   (API key 72 din valid hoti hai). Is project me `secrets/store-credentials.json`
   ke `edge` section me `clientId` + `apiKey` pehle se hain.
3. `secrets/store-credentials.json` me `addonId` bharo.
4. Upload (draft):
   ```
   node tools/upload.mjs edge
   ```
5. Jab draft ready ho aur certification ke liye submit karna ho:
   ```
   node tools/upload.mjs edge --publish
   ```

> **Zaroori:** Agar koi purani submission abhi **in review** hai to publish fail
> hoga (`InProgressSubmission`). Pehle v1.0.1 ke publish hone ka wait karo,
> phir 1.0.2 submit karo - warna review reset/supersede ho sakta hai.
