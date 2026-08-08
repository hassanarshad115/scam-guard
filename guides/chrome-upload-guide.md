# Chrome Web Store me Scam Guard upload karne ka guide

Chrome me sirf ek chhota sa one-time fee hai: **$5** (registration ke liye,
har extension ka alag nahi). Is fee se ek account me **20 extensions** tak publish
kar sakte hain.

## Pehli dafa setup ($5 fee)

1. **Chrome Web Store Developer Dashboard** kholein:
   `https://chrome.google.com/webstore/devconsole`
2. Google account se login karein.
3. **Developer account** register karein aur **$5 fee** pay karein.
4. **2-Step Verification** ON karna hota hai (security ke liye) - phone number
   link kar lein.

## Extension publish

1. Build karein: `node tools/build.mjs` -> `dist\scamguard-v1.0.2-chrome.zip`.
2. Dashboard me **"New item"** -> zip upload karein.
3. Tabs fill karein:
   - **Store listing** - name, description, screenshots (text `seo-listing-guide.md` me)
   - **Privacy practices** - data collect nahi hota, koi option select nahi karna
   - **Distribution** - "Public" (ya pehle test ke liye "Unlisted")
4. Review me bhejein. Google manually review karta hai - pehli dafa 2-5 din lag sakte hain.

## Privacy / Single purpose (important - rejection se bachne ke liye)

Chrome policy ke mutabiq:
- Extension ka **single purpose** clear hona chahiye: *"Fake/phishing websites ki warning"*.
- **Remote code** (internet se aaya hua JS) allowed nahi hai. Hamara code 100% bundled hai,
  is liye koi masla nahi.
- Privacy form me **"collects no data"** wale options chunein.

## Updates

- Dashboard me extension -> **"Package"** tab -> naya zip upload -> **"Submit for review"**.
- Har update par review hota hai, lekin purani version tab tak live rehti hai jab tak
  nayi approve na ho.

## 20-limit kya hai?

Har Chrome developer account me ek waqt me 20 extensions reh sakti hain. Isse zyada
chahiye to dashboard se **limit increase request** kar sakte hain (account history dekhi
jati hai).
