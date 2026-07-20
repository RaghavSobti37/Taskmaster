# CoreKnot Desktop Beta Release

CoreKnot Desktop Beta is an Electron shell for the production app at `https://tsccoreknot.com`.
Installed users get production web changes immediately when the hosted app updates. Native shell updates
arrive through GitHub beta releases and show an update dialog inside the desktop app.

## Install

1. Open the latest GitHub prerelease named `CoreKnot Desktop Beta`.
2. Download the installer for your OS:
   - Windows: `CoreKnot-Beta-win-x64.exe`
   - macOS: `CoreKnot-Beta-mac-*.dmg`
   - Linux: `CoreKnot-Beta-linux-*.AppImage`
3. Install and launch `CoreKnot Beta`.

## Release A New Beta

```bash
npm run release:desktop:beta -- 1.0.8-beta.3
npm install
npm run desktop:smoke
npm run desktop:dist
git add package.json package-lock.json Taskmaster/client/package.json Taskmaster/server/package.json Taskmaster/desktop Taskmaster/server/openapi/spec.json docs/operations/DESKTOP_BETA_RELEASE.md .github/workflows/desktop-beta-release.yml
git commit -m "feat: package CoreKnot desktop beta"
git push origin dev
```

After the release commit is merged to `main`, `.github/workflows/desktop-beta-release.yml` creates tag
the beta release tag, builds Windows/macOS/Linux packages, publishes a GitHub prerelease, and uploads update metadata
for the `beta` channel.

## Update Behavior

- Production web code updates appear on next app load because the desktop shell opens `https://tsccoreknot.com`.
- Native shell updates use `electron-updater` with the GitHub `beta` channel.
- The app checks for updates on launch and from `CoreKnot > Check for Updates`.
- When an update exists, users see a native download prompt, then a restart/install prompt.

## Verification

Run before release:

```bash
npm run desktop:smoke
npm run desktop:dist
npm run audit:exposure
```

For a full repo confidence pass, run:

```bash
npm run build --prefix Taskmaster/client
npm test --prefix Taskmaster/client -- scripts/generateVercelConfig.test.cjs
```
