# Client ESLint debt

`npm run lint` in `client/` currently reports **2000+** issues (mostly `no-unused-vars`, `no-empty`, hooks deps). The codebase predates strict flat-config `recommended` rules.

## CI policy

GitHub Actions runs **`npm run build`** only for the client (compile gate). Lint is **not** a merge blocker until debt is burned down.

## Incremental fix strategy

1. Fix `vite.config.js` `__dirname` (add `node` globals for config file).
2. Triage `src/utils/` and `src/hooks/useTaskmasterQueries.js` (highest churn).
3. Enable `--max-warnings 0` per directory via `eslint.config.js` `files` overrides as each folder goes green.
4. Add lint to CI when `npm run lint` exits 0.

## Local

```bash
cd client && npm run lint
```
