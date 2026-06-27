#!/usr/bin/env bash
# Cache-safe Render install — never use bare `npm install` on Render (ENOTEMPTY on cached node_modules).
set -euo pipefail

export HUSKY=0
export CI=1
export RENDER=true

TARGET="${1:-api}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [ -d node_modules ]; then
  rm -rf node_modules
fi

case "$TARGET" in
  api)
    # Render Node 22 bundles npm 10; monorepo overrides/lockfile require npm 11 for `npm ci`.
    npx --yes npm@11.4.2 ci --omit=dev --workspace=coreknot-server
    ;;
  nest)
    # Include devDependencies — Nest `nest build` needs @types/* (omitted when NODE_ENV=production).
    NODE_ENV=development npx --yes npm@11.4.2 ci --workspace=@coreknot/nestjs-server
    npm run build --workspace=@coreknot/nestjs-server
    ;;
  *)
    echo "Unknown render build target: $TARGET (expected api|nest)" >&2
    exit 1
    ;;
esac
