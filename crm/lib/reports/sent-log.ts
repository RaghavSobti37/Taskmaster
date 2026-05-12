/**
 * Idempotency for scheduled reports — one successful send per (report, IST day, recipient).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const LOG_PATH = join(DATA_DIR, "reports-sent-log.json");

type Entry = { key: string; at: string };

type LogFile = { entries: Entry[] };

function ensure(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function load(): LogFile {
  ensure();
  if (!existsSync(LOG_PATH)) return { entries: [] };
  try {
    const raw = readFileSync(LOG_PATH, "utf8");
    const j = JSON.parse(raw) as LogFile;
    if (!Array.isArray(j.entries)) return { entries: [] };
    return j;
  } catch {
    return { entries: [] };
  }
}

function save(log: LogFile): void {
  ensure();
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 0), "utf8");
}

export function sentLogKey(reportId: string, istDateKey: string, recipientEmail: string): string {
  return `${reportId}|${istDateKey}|${recipientEmail.trim().toLowerCase()}`;
}

export function wasAlreadySent(reportId: string, istDateKey: string, recipientEmail: string): boolean {
  const key = sentLogKey(reportId, istDateKey, recipientEmail);
  return load().entries.some((e) => e.key === key);
}

export function recordSent(reportId: string, istDateKey: string, recipientEmail: string): void {
  const log = load();
  const key = sentLogKey(reportId, istDateKey, recipientEmail);
  if (log.entries.some((e) => e.key === key)) return;
  log.entries.push({ key, at: new Date().toISOString() });
  /** Cap file size — keep last 2000 entries */
  if (log.entries.length > 2000) log.entries = log.entries.slice(-2000);
  save(log);
}
