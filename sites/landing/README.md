# CoreKnot landing site

Deploy this folder as a **separate Vercel project** on `landing.tsccoreknot.com`.

**Vercel settings**

| Setting | Value |
|---------|--------|
| Root Directory | `sites/landing` |
| Build Command | *(from `vercel.json`)* `cd ../../client && npm run vercel-build:landing` |
| Output Directory | `../../client/dist` |

**Required env (Production):** `RENDER_API_PROXY_URL`, `VITE_API_URL` — same Render API as main app.

- Build: `VITE_SITE_MODE=landing` (via `client/.env.landing` + `vercel-build:landing`)
- Links sign-in / register to `auth.tsccoreknot.com`

DNS + Cloudflare: see `docs/CLOUDFLARE_DNS.md`.
