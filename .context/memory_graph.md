# Active State & Milestones
- [Current Focus]: v1.0.6 mobile login — committed client/vercel.json live rewrite, proxy health probe, direct-API login fallback.
- [Last Modified]: June 6, 2026

# Node Graph
- [Node: client/vercel.json] -> (committed /api rewrite to taskmaster-jfw0 — required for git deploys)
- [Node: loginRequest.js] -> (same-origin login, fallback to VITE_API_URL on proxy 404)
- [Node: apiProxyHealth.js] -> (GET /api/health probe; drives apiBase routing)
- [Node: generateVercelConfig.js] -> (postinstall/build; bans CoreKnot-jfw0)
- [Node: verifyMobileApiProxy.js] -> (npm run verify:mobile-proxy)

# Known Gotchas
- Git push with YOUR-RENDER-SERVICE placeholder in vercel.json breaks mobile login until fixed.
- Never use CoreKnot-jfw0.onrender.com — suspended/wrong host.
- Desktop may work when mobile fails (direct API vs broken /api proxy).
