#!/usr/bin/env node
/**
 * Reassign leads that are assigned to anyone other than Shivam, Satyam & Aryaman
 * to Shivam and Satyam only (equally and randomly). Updates data/leads.csv in place.
 *
 * Run from project root: node scripts/reassign-other-reps-to-shivam-satyam.mjs
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

// Only Shivam and Satyam (exclude Aryaman)
const TARGET_REP_IDS = ["sr07", "sr06"]; // Shivam, Satyam

// Leads assigned to these reps are left unchanged
const KEEP_REP_IDS = new Set(["sr06", "sr07", "sr09"]); // Satyam, Shivam, Aryaman

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
    console.error("data/leads.csv not found.");
    process.exit(1);
  }

  const content = readFileSync(LEADS_PATH, "utf8");
  const rows = parseCsv(content);
  if (rows.length === 0) {
    console.log("No data rows in leads.csv.");
    return;
  }

  const toReassign = rows
    .map((r, i) => {
      const rep = String(r.assigned_rep_id ?? "").trim();
      if (!rep) return null;
      if (KEEP_REP_IDS.has(rep)) return null;
      return i;
    })
    .filter((i) => i !== null);

  if (toReassign.length === 0) {
    console.log("No leads assigned to other reps. All leads are already with Shivam, Satyam or Aryaman.");
    return;
  }

  const shuffled = shuffle(toReassign);
  const now = new Date().toISOString();

  shuffled.forEach((rowIdx, i) => {
    rows[rowIdx].assigned_rep_id = TARGET_REP_IDS[i % TARGET_REP_IDS.length];
    rows[rowIdx].updated_at = now;
  });

  writeLeadsFull(rows);

  const perRep = { sr07: 0, sr06: 0 };
  shuffled.forEach((_, i) => {
    perRep[TARGET_REP_IDS[i % TARGET_REP_IDS.length]]++;
  });

  console.log(`Reassigned ${toReassign.length} lead(s) from other reps to Shivam and Satyam:`);
  console.log(`  Shivam (sr07):  ${perRep.sr07}`);
  console.log(`  Satyam (sr06):  ${perRep.sr06}`);
  console.log("Updated data/leads.csv.");
}

main();
