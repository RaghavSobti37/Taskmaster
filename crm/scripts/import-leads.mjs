#!/usr/bin/env node
/**
 * Import leads from Exly CSV to local leads.csv
 * Usage: node scripts/import-leads.mjs <path-to-csv>
 * Example: node scripts/import-leads.mjs ~/Downloads/Txn\ Analysis\ -\ Sonesh\ -\ Sheet6.csv
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../data");
const LEADS_PATH = join(DATA_DIR, "leads.csv");

const LEADS_HEADERS = [
  "row_id",
  "customer_id_exly",
  "transaction_id_exly",
  "assigned_rep_id",
  "name",
  "email",
  "phone",
  "webinar_dates",
  "attended",
  "attendance_duration_min",
  "qna_answered",
  "artist_type",
  "full_time_willingness",
  "primary_role",
  "learning_goal",
  "learned_music",
  "current_journey",
  "meaningful_connect",
  "lead_quality",
  "call_status",
  "lead_status",
  "remarks",
  "plan_option",
  "locked_by",
  "locked_at",
  "created_at",
  "updated_at",
];

const SOURCE_COLUMN_MAP = {
  customer_id_exly: "customer_id_exly",
  transaction_id_exly: "transaction_id_exly",
  name: "name",
  email: "email",
  phone: "phone",
  artist_type: "artist_type",
  learning_goal: "learning_goal",
  current_journey: "current_journey",
  primary_role: "primary_role",
  full_time_willingness: "full_time_willingness",
  attended: "attended",
  attendance_duration_min: "attendance_duration_min",
  webinar_dates: "webinar_dates",
  learned_music: "learned_music",
  assigned_rep_id: "assigned_rep_id",
  call_status: "call_status",
  lead_quality: "lead_quality",
  lead_status: "lead_status",
  qna_answered: "qna_answered",
  remarks: "remarks",
};

const SDR_IDS = ["sr06", "sr07", "sr08", "sr09"];
const REP_ALIASES = {
  sr06: "sr06",
  sr07: "sr07",
  sr08: "sr08",
  sr09: "sr09",
  satyam: "sr06",
  shivam: "sr07",
  harshika: "sr08",
  aryaman: "sr09",
};

function normalizeRepId(raw) {
  const key = String(raw ?? "").trim().toLowerCase();
  return REP_ALIASES[key] || "";
}

function pickLeastLoadedRep(counts) {
  return [...SDR_IDS].sort((a, b) => {
    const diff = (counts[a] ?? 0) - (counts[b] ?? 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  })[0];
}

function nanoid(size = 10) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < size; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function escape(val) {
  const s = String(val ?? "").trim();
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Parse CSV with quoted fields and embedded newlines (RFC 4180 style) */
function parseCsv(content) {
  const rows = [];
  let i = 0;
  const len = content.length;

  function readField() {
    let field = "";
    if (content[i] === '"') {
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

  function skipLineEnd() {
    if (content[i] === "\r") i++;
    if (content[i] === "\n") i++;
  }

  while (i < len) {
    const row = [];
    while (i < len && content[i] !== "\n" && content[i] !== "\r") {
      row.push(readField());
      if (content[i] === ",") i++;
    }
    if (row.length > 0) rows.push(row);
    skipLineEnd();
  }
  return rows;
}

function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: node scripts/import-leads.mjs <path-to-csv>");
    process.exit(1);
  }
  if (!existsSync(csvPath)) {
    console.error("File not found:", csvPath);
    process.exit(1);
  }

  const content = readFileSync(csvPath, "utf8");
  const parsed = parseCsv(content);
  if (parsed.length < 2) {
    console.error("CSV must have header + at least one row");
    process.exit(1);
  }

  const sourceHeaders = parsed[0].map((h) => String(h).trim().toLowerCase().replace(/\s+/g, "_"));
  const dataRows = parsed.slice(1);
  const now = new Date().toISOString();

  const outRows = [];
  let skipped = 0;
  let autoAssigned = 0;
  const repCounts = Object.fromEntries(SDR_IDS.map((id) => [id, 0]));

  for (const vals of dataRows) {
    const row = {};
    sourceHeaders.forEach((h, idx) => {
      row[h] = vals[idx] ?? "";
    });

    const name = String(row.name ?? "").trim();
    const email = String(row.email ?? "").trim();
    const phone = String(row.phone ?? "").trim();
    if (!name && !email && !phone) {
      skipped++;
      continue;
    }

    const out = {};
    const repId = normalizeRepId(row.assigned_rep_id);
    const finalRep = repId || pickLeastLoadedRep(repCounts);
    if (!repId) autoAssigned++;
    repCounts[finalRep] = (repCounts[finalRep] ?? 0) + 1;
    LEADS_HEADERS.forEach((h) => {
      if (h === "row_id") out[h] = nanoid(10);
      else if (h === "created_at" || h === "updated_at") out[h] = now;
      else if (h === "meaningful_connect" || h === "plan_option" || h === "locked_by" || h === "locked_at") out[h] = "";
      else if (h === "assigned_rep_id") out[h] = finalRep;
      else {
        const src = SOURCE_COLUMN_MAP[h] || h;
        const srcVal = row[src] ?? row[src.toLowerCase?.()] ?? "";
        out[h] = srcVal;
      }
    });
    outRows.push(out);
  }

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  let csv = LEADS_HEADERS.map(escape).join(",") + "\n";
  for (const r of outRows) {
    csv += LEADS_HEADERS.map((h) => escape(r[h])).join(",") + "\n";
  }

  writeFileSync(LEADS_PATH, csv, "utf8");

  console.log(`Imported ${outRows.length} leads to ${LEADS_PATH}`);
  if (skipped) console.log(`Skipped ${skipped} empty rows`);
  if (autoAssigned) console.log(`Auto-assigned ${autoAssigned} lead(s) to SDR IDs.`);
  console.log("Distribution:", repCounts);
}

main();
