# Cloudflare DNS — CoreKnot subdomains

**Current registrar DNS:** `tsccoreknot.com` uses **GoDaddy** nameservers (`domaincontrol.com`), not Cloudflare. Add subdomain CNAMEs at GoDaddy, or migrate the zone to Cloudflare then run `node scripts/provision-subdomain-dns.cjs`.

Three Vercel projects serve the frontend:

| Vercel project | Root directory | Custom domain |
|----------------|----------------|---------------|
| `taskmaster` | `client/` | `tsccoreknot.com`, `www.tsccoreknot.com` |
| `coreknot-landing` | repo root + `sites/landing/vercel.json` | `landing.tsccoreknot.com` |
| `coreknot-auth` | repo root + `sites/auth/vercel.json` | `auth.tsccoreknot.com` |

API stays on Render (not Cloudflare). Session cookies use `domain: .tsccoreknot.com`.

---

## 1. Add domains in Vercel (each project)

For **each** of the three projects:

1. Vercel → Project → **Settings** → **Domains**
2. Add the custom domain(s) from the table above
3. Copy the DNS targets Vercel shows (usually `cname.vercel-dns.com` or similar)

Do this **before** creating Cloudflare records so you have the correct targets.

---

## 1b. Vercel build settings (`coreknot-landing` / `coreknot-auth`)

In each project → **Settings** → **Build & Development** (override with repo `sites/*/vercel.json`):

| Setting | `coreknot-landing` | `coreknot-auth` |
|---------|-------------------|-----------------|
| Root Directory | `.` (Taskmaster repo root) | `.` |
| Install Command | `node scripts/vercelSplitInstall.js` | same |
| Build Command | `node scripts/vercelSplitBuild.js landing` | `node scripts/vercelSplitBuild.js auth` |
| Output Directory | `client/dist` | `client/dist` |

Or with `VERCEL_TOKEN` in `.cursor/vercel-api.local.env`:

```bash
node scripts/configure-vercel-split-projects.cjs
```

Redeploy both projects after saving.

---

In **Cloudflare** → **tsccoreknot.com** → **DNS** → **Records**:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| `CNAME` | `@` | Vercel apex target (see below) | DNS only (grey cloud) recommended |
| `CNAME` | `www` | `cname.vercel-dns.com` (or Vercel-assigned) | DNS only |
| `CNAME` | `landing` | Vercel landing project target | DNS only |
| `CNAME` | `auth` | Vercel auth project target | DNS only |

### Apex (`@` / `tsccoreknot.com`)

Vercel supports apex via:

- **CNAME flattening** — Cloudflare CNAME at `@` pointing to `cname.vercel-dns.com`, or
- **A record** — `76.76.21.21` (Vercel anycast IP; confirm in Vercel domain settings)

Use the exact value Vercel shows when you add `tsccoreknot.com`.

### Proxy status (orange vs grey cloud)

**Recommended for Vercel:** **DNS only** (grey cloud) on all four hostnames.

Orange-cloud proxy can interfere with:

- Vercel SSL certificate issuance
- WebSocket to Render (desktop uses direct API; mobile uses Vercel `/api` rewrite)
- Cookie `domain=.tsccoreknot.com` edge cases

If you must proxy, set SSL/TLS to **Full (strict)** and test login on mobile after deploy.

---

## 3. Vercel environment variables (all three projects)

Set on **Production** (and **Preview** if you use staging API):

| Variable | Example | Required |
|----------|---------|----------|
| `RENDER_API_PROXY_URL` | `https://YOUR-RENDER-SERVICE.onrender.com` | Yes — mobile `/api` login |
| `VITE_API_URL` | Same Render URL | Yes — desktop API + socket.io |

**Main app project only** (`client/`):

| Variable | Example |
|----------|---------|
| `VITE_LANDING_URL` | `https://landing.tsccoreknot.com` |
| `VITE_AUTH_URL` | `https://auth.tsccoreknot.com` |
| `VITE_APP_URL` | `https://tsccoreknot.com` |

Landing and auth builds read `client/.env.landing` and `client/.env.auth` (committed). No extra site-mode vars needed unless overriding URLs.

---

## 4. Render API (backend)

On Render → API service → **Environment**:

| Variable | Production value |
|----------|------------------|
| `FRONTEND_URL` | `https://tsccoreknot.com` |
| `CLIENT_URL` | `https://tsccoreknot.com` |
| `AUTH_FRONTEND_URL` | `https://auth.tsccoreknot.com` |
| `CORS_ALLOWED_ORIGINS` | Include all three: `https://tsccoreknot.com`, `https://landing.tsccoreknot.com`, `https://auth.tsccoreknot.com` |

Redeploy API after changing cookie/CORS vars.

Google OAuth (Cloud Console) authorized redirect URI stays on **Render**:

`https://YOUR-RENDER-SERVICE.onrender.com/api/auth/google/callback`

Post-login redirect goes to `auth.tsccoreknot.com/auth/google/success` via `AUTH_FRONTEND_URL`.

---

## 5. Verify after deploy

```bash
# DNS resolves
dig +short landing.tsccoreknot.com
dig +short auth.tsccoreknot.com

# HTTPS + SPA
curl -sI https://landing.tsccoreknot.com/ | head -5
curl -sI https://auth.tsccoreknot.com/login | head -5

# Mobile API proxy (each hostname)
curl -sI https://auth.tsccoreknot.com/api/health | head -5
```

Browser checks:

1. `https://landing.tsccoreknot.com` → marketing page; Sign in → `auth.tsccoreknot.com/login`
2. Login → redirect to `https://tsccoreknot.com/dashboard` (session cookie on `.tsccoreknot.com`)
3. `https://tsccoreknot.com/login` → redirects to `auth.tsccoreknot.com/login`
4. Logged-out `https://tsccoreknot.com/` → redirects to `landing.tsccoreknot.com`

---

## 6. Regenerate `vercel.json` (local / CI)

From repo root:

```bash
RENDER_API_PROXY_URL=https://YOUR-RENDER-SERVICE.onrender.com node client/scripts/generateVercelConfig.cjs
```

Updates `vercel.json`, `client/vercel.json`, `sites/landing/vercel.json`, and `sites/auth/vercel.json` with the correct `/api` and `/socket.io` rewrites.

---

## 7. Automated setup (optional)

With gitignored credential files:

```bash
# Copy examples → fill values:
#   .cursor/production-hosts.local.json
#   .cursor/render-api.local.env
#   .cursor/vercel-api.local.env      (optional)
#   .cursor/cloudflare-api.local.env  (optional)
#   .cursor/posthog.local.env         (optional)

node scripts/setup-production-full.js --dry-run
node scripts/setup-production-full.js --all
npm run production:setup
```

Vercel projects must exist first (link repo, root directories from table above). Script updates env + DNS; redeploy all three Vercel projects after merge.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Subdomain 404 / Vercel default page | Domain not added to correct Vercel project, or wrong Root Directory |
| Mobile login 404 on `/api/auth/login` | Missing `RENDER_API_PROXY_URL` on that Vercel project |
| Login works but dashboard 401 | Cookie domain — confirm API redeployed; check `Set-Cookie` has `Domain=.tsccoreknot.com` |
| Google OAuth lands on wrong host | Set `AUTH_FRONTEND_URL=https://auth.tsccoreknot.com` on Render |
| Post-login stuck on auth host | Rebuild auth project after `navigateAfterAuth` fix (should redirect to app URL) |
| SSL handshake error | Cloudflare proxy on orange cloud — try DNS only or Full (strict) |

See also: `docs/DEPLOY_ENV.md`, `.specify/memory/platform/deployment.md`.
