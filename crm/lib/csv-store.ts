/**
 * Local CSV store - fast reads, manual sync to Google Sheet.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { LEADS_HEADERS, EMI_HEADERS, AUDIT_HEADERS } from "./schema";

const DATA_DIR = join(process.cwd(), "data");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

/** Parse CSV with quoted fields and embedded newlines (RFC 4180). Do NOT split by newline first. */
function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let i = 0;
  const len = content.length;

  function readField(): string {
    let field = "";
    if (i < len && content[i] === '"') {
      i++;
      while (i < len) {
        if (content[i] === '"') {
          if (content[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += content[i];
          i++;
        }
      }
    } else {
      while (i < len && content[i] !== "," && content[i] !== "\n" && content[i] !== "\r") {
        field += content[i];
        i++;
      }
    }
    return field;
  }

  function skipDelim(): void {
    if (content[i] === "\r") i++;
    if (content[i] === "\n") i++;
  }

  while (i < len) {
    const row: string[] = [];
    while (i < len && content[i] !== "\n" && content[i] !== "\r") {
      row.push(readField());
      if (content[i] === ",") i++;
    }
    if (row.length > 0) rows.push(row);
    skipDelim();
  }

  if (rows.length < 2) return [];
  const h = rows[0].map((x) => x.trim());
  return rows.slice(1).map((vals) => {
    const obj: Record<string, string> = {};
    h.forEach((key, idx) => {
      obj[key] = vals[idx] ?? "";
    });
    return obj;
  });
}

function escape(val: string): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n"))
    return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ——— Leads ———

const LEADS_PATH = join(DATA_DIR, "leads.csv");

function getLeadsRaw(): string {
  ensureDir();
  if (!existsSync(LEADS_PATH)) {
    writeFileSync(LEADS_PATH, LEADS_HEADERS.join(",") + "\n", "utf8");
  }
  return readFileSync(LEADS_PATH, "utf8");
}

export function getLeads(): Array<Record<string, string> & { row_index: number }> {
  const content = getLeadsRaw();
  const rows = parseCsv(content);
  return rows.map((r, i) => ({ ...r, row_index: i + 2 } as Record<string, string> & { row_index: number }));
}

export function getLeadByRowIndex(rowIndex: number): Record<string, string> | null {
  const rows = getLeads();
  const idx = rowIndex - 2;
  if (idx < 0 || idx >= rows.length) return null;
  return rows[idx];
}

export function appendLead(row: Record<string, string | number>): void {
  ensureDir();
  const line = LEADS_HEADERS.map((h) => escape(String(row[h] ?? ""))).join(",") + "\n";
  const content = getLeadsRaw();
  writeFileSync(LEADS_PATH, content + line, "utf8");
}

export function updateLead(rowIndex: number, updates: Record<string, string>): void {
  const content = getLeadsRaw();
  const rows = parseCsv(content);
  if (rows.length === 0 || rowIndex < 2) return;
  const idx = rowIndex - 2; // 0-based row (row 2 = first data row)
  if (idx < 0 || idx >= rows.length) return;
  const row = rows[idx];
  LEADS_HEADERS.forEach((h) => {
    if (updates[h] !== undefined) row[h] = String(updates[h]);
  });
  writeLeadsFull(rows);
}

function writeLeadsFull(rows: Record<string, string>[]): void {
  ensureDir();
  let csv = LEADS_HEADERS.map((h) => escape(h)).join(",") + "\n";
  for (const r of rows) {
    csv += LEADS_HEADERS.map((h) => escape(r[h] ?? "")).join(",") + "\n";
  }
  writeFileSync(LEADS_PATH, csv, "utf8");
}

export function appendLeads(rows: Record<string, string>[]): void {
  ensureDir();
  const content = getLeadsRaw();
  const newLines = rows.map((r) =>
    LEADS_HEADERS.map((h) => escape(r[h] ?? "")).join(",")
  );
  writeFileSync(LEADS_PATH, content + newLines.join("\n") + "\n", "utf8");
}

// ——— EMI ———

const EMI_PATH = join(DATA_DIR, "emis.csv");

export function getEmis(): Record<string, string>[] {
  ensureDir();
  if (!existsSync(EMI_PATH)) {
    writeFileSync(EMI_PATH, EMI_HEADERS.join(",") + "\n", "utf8");
  }
  const content = readFileSync(EMI_PATH, "utf8");
  return parseCsv(content);
}

export function getEmisByLead(leadRowId: string): Record<string, string>[] {
  return getEmis().filter((r) => r.lead_row_id === leadRowId);
}

export function appendEmi(row: Record<string, string>): void {
  ensureDir();
  const content = existsSync(EMI_PATH) ? readFileSync(EMI_PATH, "utf8") : EMI_HEADERS.join(",") + "\n";
  const line = EMI_HEADERS.map((h) => escape(row[h] ?? "")).join(",") + "\n";
  writeFileSync(EMI_PATH, content + line, "utf8");
}

// ——— Audit ———

const AUDIT_PATH = join(DATA_DIR, "audit.csv");

export function getAudit(): Record<string, string>[] {
  ensureDir();
  if (!existsSync(AUDIT_PATH)) {
    writeFileSync(AUDIT_PATH, AUDIT_HEADERS.join(",") + "\n", "utf8");
  }
  const content = readFileSync(AUDIT_PATH, "utf8");
  return parseCsv(content);
}

export function getAuditByLead(leadRowId: string): Record<string, string>[] {
  return getAudit().filter((r) => r.lead_row_id === leadRowId);
}

/** Lead row_ids that have at least one audit entry with timestamp > sinceIso (for incremental sync). */
export function getLeadRowIdsChangedSince(sinceIso: string): Set<string> {
  const audit = getAudit();
  const set = new Set<string>();
  for (const r of audit) {
    const ts = r.timestamp || "";
    const rid = r.lead_row_id || "";
    if (rid && ts && ts > sinceIso) set.add(rid);
  }
  return set;
}

export function appendAudit(row: Record<string, string>): void {
  ensureDir();
  const content = existsSync(AUDIT_PATH) ? readFileSync(AUDIT_PATH, "utf8") : AUDIT_HEADERS.join(",") + "\n";
  const line = AUDIT_HEADERS.map((h) => escape(row[h] ?? "")).join(",") + "\n";
  writeFileSync(AUDIT_PATH, content + line, "utf8");
}
