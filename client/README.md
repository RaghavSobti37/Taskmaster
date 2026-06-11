# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Troubleshooting

If Vite fails on startup (e.g. missing `dep-D-7KCb9p.js` or other corrupted `node_modules` on OneDrive/Windows):

```bash
cd client
rm -rf node_modules
npm install
npm run dev
```

PowerShell:

```powershell
cd client
Remove-Item -Recurse -Force node_modules
npm install
npm run dev
```

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
