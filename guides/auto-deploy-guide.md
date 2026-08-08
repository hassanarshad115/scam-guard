# Auto-Deploy Guide - GitHub se teeno stores tak

Jab yeh system set ho jayega, aapko **sirf ek kaam** karna hoga:

> **"Yeh feature add karo"** batana - code GitHub par push, phir `node tools/release.mjs 1.1.0` + tag push
> = teeno stores (Chrome, Firefox, Edge) khud upload + publish.

## Kya ho raha hai (ek nazar)

```
Aap VS Code me change karo -> commit -> tag push (v1.1.0)
        |
        v
GitHub Actions khud:
  1. Tests chalata hai (source + minified build dono)
  2. Build + zip banata hai (version-dynamic)
  3. Chrome, Firefox, Edge par upload + publish karta hai
        |
        v
Stores review -> users ke browsers me auto-update
```

---

## Ek dafa ka setup (30-60 min) - SIRF PEHLE DAFI

### Step 1: Repo GitHub par daalo
VS Code me Terminal kholo (project folder me) aur yeh run karo:

```
git init
git add .
git commit -m "initial release v1.0.0"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/scam-guard.git
git push -u origin main
```

(`YOUR-USERNAME` ki jagah apna GitHub username. Repo pehle GitHub par bana lo - `New repository` -> Public.)

### Step 2: Store credentials banao (BPP_KEYS)

Yeh 3 cheezein chahiyein, teeno stores ke developer dashboards se:

| Store | Kya chahiye | Kahan se |
|---|---|---|
| **Chrome** | `extId` + OAuth `clientId` + `clientSecret` + `refreshToken` | Google Cloud Console + Chrome Developer Dashboard |
| **Firefox** | `extId` + `apiKey` + `apiSecret` | addons.mozilla.org -> "Manage API keys" |
| **Edge** | `productId` + `clientId` + `apiKey` | Microsoft Partner Center |

**Chrome ke OAuth credentials banane ka tarika** (sabse mushkil hissa):
1. `console.cloud.google.com` -> naya project banao
2. APIs & Services -> **Chrome Web Store API** enable karo
3. OAuth consent screen -> External -> apna email test user banao
4. Credentials -> OAuth Client ID (Desktop app) -> Client ID + Secret copy karo
5. Refresh token banao:
   ```
   npx chrome-webstore-upload-keys
   ```
   (Client ID/Secret maangega, phir browser me allow karo)

**Firefox API keys:**
1. `addons.mozilla.org` -> login -> **Manage My Submissions** -> **Manage API keys**
2. JWT issuer (apiKey) + secret (apiSecret) copy karo

**Edge:**
1. Partner Center me extension banao -> `productId` milta hai
2. Azure AD app se `clientId` + client secret (`apiKey`) banate hain
   (detailed steps: `partner.microsoft.com` -> Add-ons -> "Publish API" docs)

### Step 3: BPP_KEYS secret banao (GitHub par)

In sab keys ko ek JSON me likho:

```json
{
  "chrome": {
    "extId": "your-chrome-extension-id",
    "clientId": "your-client-id.apps.googleusercontent.com",
    "clientSecret": "your-client-secret",
    "refreshToken": "your-refresh-token"
  },
  "firefox": {
    "extId": "scamguard@youragency.example",
    "apiKey": "your-firefox-api-key",
    "apiSecret": "your-firefox-api-secret"
  },
  "edge": {
    "productId": "your-edge-product-id",
    "clientId": "your-azure-client-id",
    "apiKey": "your-azure-client-secret"
  }
}
```

> **Zaroori:** Sirf wahi store rakho jinke keys complete hain. Invalid/empty config = fail.

**GitHub par:**
1. Apne repo -> **Settings** -> **Secrets and variables** -> **Actions**
2. **New repository secret** -> Name: `BPP_KEYS` -> Value: upar wala poora JSON
3. Save

### Step 4: Workflow file push karo

`.github/workflows/publish.yml` pehle se ready hai is project me. Bas commit + push:

```
git add .
git commit -m "add auto-publish workflow"
git push
```

---

## Rozmarra ka use (jab bhi update dena ho)

**Aap bas yeh batana:** "Version 1.1.0 me [feature] add karo"

**Phir main yeh karta hoon:**
```
node tools/release.mjs 1.1.0      # version bump + tests + build
git add .
git commit -m "release: v1.1.0"
git tag v1.1.0
git push origin main --tags        # YE HAI TRIGGER
```

`git push --tags` ke baad sab khud hota hai - Actions tab me dikhega.

---

## Important baatein (imandari)

1. **"Instant" nahi** - har store har version ko khud review karta hai:
   - Chrome: 2-5 din, Firefox: 1-2 din, Edge: 1-3 din
   - Auto-deploy sirf **upload** karta hai; store ka approval zaroori hai
2. **Pehli dafa har store par MANUAL publish** hota hai (extension create karna hota hai).
   Auto-deploy sirf **naye versions** ke liye chalta hai.
3. **Version hamesha badhao** - tag version manifest se match hona chahiye,
   aur purani se zyada. `release.mjs` khud check karta hai.
4. **Firefox source code zip** maang sakta hai (unlisted versions ke liye).
   Agar puchhe to `dist/` wala folder zip kar do.

---

## Troubleshooting

| Problem | Hal |
|---|---|
| Workflow "not found" error | Repo **private** hai to bhi chalta hai, bas `publish.yml` path check karo |
| Chrome upload reject | `extId` galat? Version purane se zyada hona chahiye |
| Firefox reject | `gecko.id` manifest me hai (pehle se hai: `scamguard@youragency.example`) |
| BPP_KEYS invalid | JSON format check karo - empty `{}` object nahi chahiye |
| Test fail ho jaye | Workflow khud build rokti hai - koi bhi version publish nahi hota |

## Files is system me

| File | Kaam |
|---|---|
| `.github/workflows/publish.yml` | Auto-publish pipeline (tag trigger) |
| `tools/release.mjs` | Version bump + tests + build + git instructions |
| `tools/build.mjs` | Build (ab version manifest se leta hai) |
