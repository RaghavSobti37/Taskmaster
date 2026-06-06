# Active State & Milestones
- [Current Focus]: v1.0.6 mobile login hardening — Vercel /api proxy repair, first-party Lax cookies, stale-session purge on login, production proxy smoke test.
- [Last Modified]: June 6, 2026

# Node Graph (Entities & Components)
- [Node: authCookie.js] -> (isFirstPartyProxiedRequest via X-Forwarded-Host/Origin/Referer; replaceAuthCookie clears legacy SameSite variants)
- [Node: LoginPage.jsx] -> (purgeAuthCookies on mount + pre-submit; formatLoginError; apiPath for login/logout)
- [Node: AuthContext.jsx] -> (applyAxiosBaseURL on visibility/pageshow resume for mobile/PWA)
- [Node: generateVercelConfig.js] -> (RENDER_API_PROXY_URL / VITE_API_URL / production-hosts.local.json → client/vercel.json rewrites)
- [Node: verifyMobileApiProxy.js] -> (GET /api/health on frontend domain; npm run verify:mobile-proxy)
- [Node: displayMode.js] -> (shouldUseSameOriginApi for phone/tablet/PWA → Vercel /api proxy)

# Edge Graph (Dependencies & Data Flow)
- [Mobile browser] --(same-origin)--> [Vercel /api rewrite] --(proxy)--> [Render API taskmaster-jfw0]
- [Desktop browser] --(cross-origin)--> [Render API via VITE_API_URL]
- [LoginPage] --(POST)--> [/api/auth/login] --(Set-Cookie)--> [coreknot_token_v3 Lax when proxied]

# Known Gotchas & Constraints
- RENDER_API_PROXY_URL pointing at CoreKnot-jfw0 causes /api 404 on mobile; desktop direct API may still work.
- Never commit production-hosts.local.json or .vercel env pulls; vercel.json uses YOUR-RENDER-SERVICE placeholder in git.
- iOS PWA: users should Clear session cookies after auth deploys; re-add home-screen shortcut if sessions stick.
- KEEP_WARM_URL on Render cron must be set manually in Dashboard to live /api/health URL.
