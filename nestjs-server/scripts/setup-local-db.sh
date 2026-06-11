#!/usr/bin/env bash
# Creates local Postgres database from DATABASE_URL in nestjs-server/.env (or .env.example).
# Requires psql on PATH.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SERVER_ROOT/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="$SERVER_ROOT/.env.example"
fi

DATABASE_URL="$(grep -E '^\s*DATABASE_URL\s*=' "$ENV_FILE" | head -1 | sed -E 's/^\s*DATABASE_URL\s*=\s*//' | tr -d '"' | tr -d "'")"

if [[ -z "$DATABASE_URL" ]]; then
  echo "DATABASE_URL not found in $ENV_FILE" >&2
  exit 1
fi

if [[ ! "$DATABASE_URL" =~ ^postgresql://([^:]+):([^@]+)@([^:/]+):([0-9]+)/([^?/]+) ]]; then
  echo "Cannot parse DATABASE_URL (expected postgresql://user:pass@host:port/dbname): $DATABASE_URL" >&2
  exit 1
fi

USER="${BASH_REMATCH[1]}"
PASS="${BASH_REMATCH[2]}"
PGHOST="${BASH_REMATCH[3]}"
PORT="${BASH_REMATCH[4]}"
DBNAME="${BASH_REMATCH[5]}"

export PGPASSWORD="$PASS"

EXISTS="$(psql -h "$PGHOST" -p "$PORT" -U "$USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DBNAME'")"
if [[ "$EXISTS" == "1" ]]; then
  echo "Database '$DBNAME' already exists."
else
  psql -h "$PGHOST" -p "$PORT" -U "$USER" -d postgres -c "CREATE DATABASE \"$DBNAME\";"
  echo "Created database '$DBNAME'."
fi

echo "Next: cd nestjs-server && npx prisma db push"
