# Syncing data files (server → local)

The CRM uses file-based data under `data/`:

- **leads.csv** – lead records
- **audit.csv** – audit log (edits)
- **emis.csv** – EMI tracking
- **sync_state.json** – last sync time for incremental sheet sync

To get the latest data from the server onto your machine, use one of the approaches below.

---

## 1. Prerequisites

- **SSH access** to the server where the app runs (key-based auth recommended).
- **rsync** on your machine (macOS/Linux usually have it; Windows: WSL or install rsync).

---

## 2. One-time setup

1. **Know your server and path**
   - Server: `user@host` (e.g. `deploy@myserver.com`).
   - Path to the app’s `data/` on the server. Examples:
     - If the app lives at `/var/www/crm`, then the data dir is `/var/www/crm/data`.
     - If you run in Docker and data is in a volume, use the path **inside** the container if you rsync via `docker exec`, or the host path that’s mounted (see below).

2. **Optional: env file for the script**
   - Copy and edit so the script can be run without typing the server each time:
   - `cp scripts/sync-data-from-server.example.env scripts/sync-data-from-server.env`
   - Edit `sync-data-from-server.env` and set `SERVER` and, if needed, `REMOTE_PATH`.
   - **Do not commit** `sync-data-from-server.env` (it’s in `.gitignore` if we add it).

---

## 3. Sync with the script (recommended)

From the CRM repo root (`tsc/crm/`):

```bash
# Minimum: set server
SERVER=user@your-server.com ./scripts/sync-data-from-server.sh

# With custom remote path (absolute path on server)
SERVER=user@your-server.com REMOTE_PATH=/var/www/crm/data ./scripts/sync-data-from-server.sh

# If you use the optional .env file:
source scripts/sync-data-from-server.env && ./scripts/sync-data-from-server.sh
```

This **overwrites** local `data/*` with the server’s copies (only changed files are transferred).

---

## 4. Manual rsync

Same idea without the script:

```bash
cd /path/to/tsc/crm
mkdir -p data
rsync -avz user@server:/path/to/crm/data/ data/
```

---

## 5. If the app runs in Docker on the server

Option A – rsync from the host (if `data/` is bind-mounted):

```bash
# Example: host path /home/deploy/crm/data
rsync -avz user@server:/home/deploy/crm/data/ data/
```

Option B – copy from inside the container:

```bash
# Create a tarball on server, then scp it
ssh user@server "docker exec crm-app tar -C /app -cf - data" | tar -C . -xf -
```

(Replace `crm-app` and `/app` with your container name and app path.)

---

## 6. Safety and .gitignore

- **Backup:** The script overwrites local files. If you have local-only changes, back up `data/` first.
- **Secrets:** `data/` may contain nothing secret (IDs, emails, etc. are in the CSVs). Keep `.env` and any files with API keys out of `data/` and don’t commit them.
- **sync_state.json:** Syncing it from the server is fine; it only stores `last_leads_sync_at` for incremental sheet sync.

---

## 7. Optional: npm script

In `package.json` you can add:

```json
"scripts": {
  "sync:data": "bash scripts/sync-data-from-server.sh"
}
```

Then run (after setting `SERVER` in the environment or in `sync-data-from-server.env`):

```bash
SERVER=user@host npm run sync:data
```
