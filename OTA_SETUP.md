# OTA ek baar set karna (5 minute)

OTA channel ka **poora code taiyaar aur deployed hai**. Ek hi cheez baaki hai jo
main nahi kar sakta: repo secret `OTA_SIGNING_KEY` add karna (GitHub token ke
paas secret-write permission nahi hai).

Jab tak ye secret nahi hai, Worker saaf-saaf `503 ota_signing_key_missing`
deta hai — chupchaap unsigned update nahi bhejta. Ye jaan-boojh ke hai: app
har manifest ka signature verify karti hai, isliye unsigned update bekaar hota.

---

## 1. Secret add karo

GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**

- **Name:** `OTA_SIGNING_KEY`
- **Value:** `OTA_SIGNING_KEY.txt` file ka **poora content** (ek line, `MIIE…`
  se shuru hoti hai, `=` par khatam). Bas copy-paste — koi newline nahi.

> Ye base64 me encoded PKCS#8 private key hai (RSA-2048). Iska public half
> `assets/certificate.pem` me repo ke andar hai (CN=Kissa OTA Code Signing,
> 2036 tak valid). Dono ek hi pair hain — verified.

## 2. Worker ko secret do

Do tareeke, koi ek:

**A. Automatic (recommended):** `main` par koi bhi commit jo deploy trigger kare.
`deploy-api.yml` ab secret ko `wrangler secret put OTA_SIGNING_KEY` se Worker me
daal deta hai.

**B. Manual, turant:**
```bash
cd worker
npx wrangler secret put OTA_SIGNING_KEY < ../OTA_SIGNING_KEY.txt
```

## 3. Verify karo

```bash
curl -sD - -o /dev/null \
  "https://beyondredeye.site/api/ota/manifest?platform=android&runtime-version=2.15.0" \
  | grep -i expo-signature
```

`expo-signature: sig="…", keyid="root", alg="rsa-v1_5-sha256"` dikhna chahiye.
`503` aa raha hai to secret Worker tak nahi pahuncha (step 2 dobara).

Phir GitHub → Actions → **OTA (JS update, no APK)** → *Run workflow*.

---

## Kaise kaam karta hai (ek nazar me)

| Cheez | Kahan |
|---|---|
| App manifest maangti hai | `GET /api/ota/manifest?platform=android&runtime-version=2.15.0` |
| Manifest sign hota hai | Worker me, `OTA_SIGNING_KEY` se, **serve time** par |
| Signature app tak kaise jaata hai | `expo-signature` response header (body ke andar nahi) |
| App kya verify karti hai | `SHA256withRSA` **manifest body** par, `assets/certificate.pem` se |
| Bundle kaise aata hai | `GET /api/ota/assets/<id>/bundle` — asli `.js`, hash `base64url(sha256)` |
| Kaun publish kar sakta hai | `POST /api/ota/publish`, Bearer `ADMIN_TOKEN` |
| Rollback | `POST /api/ota/rollback?platform=android` |

**Rule:** copy/layout/bug/chhoti logic → OTA. Naya native dependency, permission,
SDK bump, icon/splash → naya APK + `vX.Y.Z` tag.

**Ordering zaroori hai:** APK ship karo → `vX.Y.Z` tag karo → uske baad ke chhote
fixes OTA se. Native guard last `v2.*` tag se compare karta hai; tag na ho to
wo har `package.json` change ko native maan kar OTA rok dega (yahi pehle hua tha).

---

## Key kho jaaye to?

Naya pair banao, certificate replace karo, secret update karo — **par ye naya
APK maangta hai**, kyunki app me pinned certificate badalta hai:

```bash
npx expo-updates codesigning:generate \
  --key-output-directory keys --certificate-output-directory cert \
  --certificate-validity-duration-years 10 \
  --certificate-common-name "Kissa OTA Code Signing"
# cert/certificate.pem  -> assets/certificate.pem
# keys/private-key.pem  -> PKCS#8 DER base64 -> OTA_SIGNING_KEY
openssl pkcs8 -topk8 -nocrypt -in keys/private-key.pem -outform DER | base64 | tr -d '\n'
```

Baaki sab automatic hai: guard + tests (fake certificate, galat hash format,
body-field signature — teeno pakadte hain).
