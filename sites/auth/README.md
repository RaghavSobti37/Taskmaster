# CoreKnot auth site

Deploy this folder as a **separate Vercel project** on `auth.tsccoreknot.com`.

**Vercel settings**

| Setting | Value |
|---------|--------|
| Root Directory | `sites/auth` |
| Build Command | *(from `vercel.json`)* `cd ../../client && npm run vercel-build:auth` |
| Output Directory | `../../client/dist` |

**Required env (Production):** `RENDER_API_PROXY_URL`, `VITE_API_URL` — same Render API as main app.

Auth routes:

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/relegends` (OTP)
- `/auth/google/success`

After login, users redirect to `https://tsccoreknot.com/dashboard` (session cookie domain: `.tsccoreknot.com`).

DNS + Cloudflare: see `docs/CLOUDFLARE_DNS.md`.
