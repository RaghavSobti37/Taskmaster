#!/usr/bin/env node
/**
 * Distribute all unassigned leads (empty assigned_rep_id) to Shivam, Satyam & Aryaman
 * equally and randomly. Updates data/leads.csv in place.
 *
 * Run from project root: node scripts/distribute-unassigned-leads.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(resolve(__dirname, ".."), "data");
const LEADS_PATH = join(DATA_DIR, "leads.csv");

// Must match lib/schema.ts LEADS_HEADERS order
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

// Shivam (sr07), Satyam (sr06), Aryaman (sr09)
const REP_IDS = ["sr07", "sr06", "sr09"];

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function parseCsv(content) {
  const rows = [];
  let i = 0;
  const len = content.length;

  function readField() {
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

  function skipDelim() {
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
    skipDelim();
  }

  if (rows.length < 2) return [];
  const h = rows[0].map((x) => x.trim());
  return rows.slice(1).map((vals) => {
    const obj = {};
    h.forEach((key, idx) => {
      obj[key] = vals[idx] ?? "";
    });
    return obj;
  });
}

function escape(val) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n"))
    return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeLeadsFull(rows) {
  ensureDir();
  let csv = LEADS_HEADERS.map((h) => escape(h)).join(",") + "\n";
  for (const r of rows) {
    csv += LEADS_HEADERS.map((h) => escape(r[h] ?? "")).join(",") + "\n";
  }
  writeFileSync(LEADS_PATH, csv, "utf8");
}

/** Fisher–Yates shuffle */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function main() {
  ensureDir();
  if (!existsSync(LEADS_PATH)) {
    console.error("data/leads.csv not found. Nothing to distribute.");
    process.exit(1);
  }

  const content = readFileSync(LEADS_PATH, "utf8");
  const rows = parseCsv(content);
  if (rows.length === 0) {
    console.log("No data rows in leads.csv.");
    return;
  }

  const unassignedIndices = rows
    .map((r, i) => (String(r.assigned_rep_id ?? "").trim() === "" ? i : null))
    .filter((i) => i !== null);

  if (unassignedIndices.length === 0) {
    console.log("No unassigned leads. All leads already have an assigned rep.");
    return;
  }

  const shuffled = shuffle(unassignedIndices);
  shuffled.forEach((rowIdx, i) => {
    rows[rowIdx].assigned_rep_id = REP_IDS[i % REP_IDS.length];
  });

  const now = new Date().toISOString();
  shuffled.forEach((rowIdx) => {
    rows[rowIdx].updated_at = now;
  });

  writeLeadsFull(rows);

  const perRep = {};
  REP_IDS.forEach((id) => (perRep[id] = 0));
  shuffled.forEach((rowIdx, i) => {
    perRep[REP_IDS[i % REP_IDS.length]]++;
  });

  console.log(`Distributed ${unassignedIndices.length} unassigned lead(s) to Shivam, Satyam & Aryaman:`);
  console.log(`  Shivam (sr07):  ${perRep.sr07}`);
  console.log(`  Satyam (sr06):  ${perRep.sr06}`);
  console.log(`  Aryaman (sr09): ${perRep.sr09}`);
  console.log("Updated data/leads.csv.");
}

main();
