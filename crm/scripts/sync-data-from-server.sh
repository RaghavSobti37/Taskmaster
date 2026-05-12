#!/usr/bin/env bash
# Sync data files (CSV + sync_state.json) from server to local data/
# Usage:
#   ./scripts/sync-data-from-server.sh
#   SERVER=user@myhost ./scripts/sync-data-from-server.sh
#   SERVER=user@myhost REMOTE_PATH=/var/app/crm/data ./scripts/sync-data-from-server.sh
#
# Prerequisites: rsync, SSH access to server (key-based auth recommended)

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRM_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$CRM_ROOT/data"

# Configure these or pass via env
SERVER="${SERVER:-}"
REMOTE_PATH="${REMOTE_PATH:-data}"   # path to data/ on the server (relative to app root or absolute)

if [ -z "$SERVER" ]; then
  echo "Usage: SERVER=user@host [REMOTE_PATH=data] $0"
  echo "Example: SERVER=deploy@myserver.com REMOTE_PATH=/var/www/crm/data $0"
  exit 1
fi

mkdir -p "$DATA_DIR"

# If REMOTE_PATH is relative, we assume server app root; else use as-is
# rsync: -a archive, -v verbose, -z compress, --progress optional
rsync -avz --progress \
  "$SERVER:${REMOTE_PATH}/" \
  "$DATA_DIR/"

echo "Synced into $DATA_DIR"
ls -la "$DATA_DIR"
