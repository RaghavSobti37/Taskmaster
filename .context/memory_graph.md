# Active State & Milestones
- [Current Focus]: v1.0.7 unified login — all devices same-origin /api; login gated on /me; socket.io Vercel rewrite.
- [Last Modified]: June 6, 2026

# Node Graph
- [Node: client/vercel.json] -> (committed /api + /socket.io rewrites to live Render API)
- [Node: apiBase.js] -> (dev + production always relative /api via Vite/Vercel proxy)
- [Node: AuthContext.jsx] -> (login() requires /api/auth/me 200 before sessionReady)
- [Node: authMiddleware.js] -> (verify JWT only; no sliding refresh or Clerk path)
- [Node: generateVercelConfig.js] -> (postinstall/build; injects /api and /socket.io destinations)
- [Node: verifyMobileApiProxy.js] -> (npm run verify:mobile-proxy)

# Known Gotchas
- Never use CoreKnot-jfw0.onrender.com — suspended/wrong host.
- `client/.env` with production `VITE_API_URL` no longer breaks local login — axios uses Vite proxy; still set localhost in `.env` for OAuth/upload helpers.
- Users upgrading from v1.0.6 may need **Clear session cookies** once on /login.
