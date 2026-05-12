/**
 * Persist last sync time so incremental sync only patches leads changed since then.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const SYNC_STATE_PATH = join(DATA_DIR, "sync_state.json");

export interface SyncState {
  last_leads_sync_at: string; // ISO
}

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function getLastLeadsSyncAt(): string | null {
  if (!existsSync(SYNC_STATE_PATH)) return null;
  try {
    const raw = readFileSync(SYNC_STATE_PATH, "utf8");
    const state = JSON.parse(raw) as SyncState;
    return state.last_leads_sync_at || null;
  } catch {
    return null;
  }
}

export function setLastLeadsSyncAt(iso: string): void {
  ensureDir();
  const state: SyncState = { last_leads_sync_at: iso };
  writeFileSync(SYNC_STATE_PATH, JSON.stringify(state, null, 0), "utf8");
}
