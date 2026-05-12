#!/usr/bin/env node
/**
 * One-time backfill:
 * - Normalize assigned_rep_id values to canonical SDR IDs.
 * - Auto-assign blank/invalid rep values to least-loaded SDR.
 *
 * Usage:
 *   node scripts/normalize-assigned-reps.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEADS_PATH = join(__dirname, "../data/leads.csv");
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

  if (rows.length < 2) return { headers: [], rows: [] };
  const headers = rows[0].map((x) => x.trim());
  const outRows = rows.slice(1).map((vals) => {
    const obj = {};
    headers.forEach((key, idx) => {
      obj[key] = vals[idx] ?? "";
    });
    return obj;
  });
  return { headers, rows: outRows };
}

function escapeCsv(val) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsv(headers, rows) {
  let csv = headers.map(escapeCsv).join(",") + "\n";
  for (const r of rows) {
    csv += headers.map((h) => escapeCsv(r[h] ?? "")).join(",") + "\n";
  }
  return csv;
}

function normalizeRep(raw) {
  const k = String(raw ?? "").trim().toLowerCase();
  return REP_ALIASES[k] || "";
}

function pickLeastLoadedRep(counts) {
  return [...SDR_IDS].sort((a, b) => {
    const diff = (counts[a] ?? 0) - (counts[b] ?? 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  })[0];
}

function main() {
  if (!existsSync(LEADS_PATH)) {
    console.error("leads.csv not found:", LEADS_PATH);
    process.exit(1);
  }

  const input = readFileSync(LEADS_PATH, "utf8");
  const { headers, rows } = parseCsv(input);
  if (headers.length === 0) {
    console.log("No data to normalize.");
    return;
  }

  const loadCounts = Object.fromEntries(SDR_IDS.map((id) => [id, 0]));
  for (const row of rows) {
    const rep = normalizeRep(row.assigned_rep_id);
    if (rep) loadCounts[rep] = (loadCounts[rep] ?? 0) + 1;
  }

  let normalized = 0;
  let autoAssigned = 0;
  const now = new Date().toISOString();
  for (const row of rows) {
    const before = String(row.assigned_rep_id ?? "");
    const normalizedRep = normalizeRep(before);
    const finalRep = normalizedRep || pickLeastLoadedRep(loadCounts);
    if (!normalizedRep) autoAssigned++;
    if (before !== finalRep) normalized++;
    row.assigned_rep_id = finalRep;
    row.updated_at = now;
    loadCounts[finalRep] = (loadCounts[finalRep] ?? 0) + 1;
  }

  const finalCounts = Object.fromEntries(SDR_IDS.map((id) => [id, 0]));
  for (const row of rows) {
    const rep = normalizeRep(row.assigned_rep_id);
    if (rep) finalCounts[rep] = (finalCounts[rep] ?? 0) + 1;
  }

  const output = writeCsv(headers, rows);
  writeFileSync(LEADS_PATH, output, "utf8");

  console.log(`Updated ${rows.length} rows.`);
  console.log(`Normalized/changed rep value on ${normalized} rows.`);
  console.log(`Auto-assigned (blank/invalid) on ${autoAssigned} rows.`);
  console.log("Final distribution:", finalCounts);
}

main();

