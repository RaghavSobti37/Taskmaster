#!/usr/bin/env node
/**
 * Seed 10 sample leads into the HolySheet Leads tab.
 * Run: node scripts/seed-leads.mjs
 * Requires: HOLYSHEET_BASE_URL, HOLYSHEET_API_KEY in .env (or env)
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const envPath = resolve(__dirname, "../.env");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  } catch {}
}

loadEnv();

const BASE = (process.env.HOLYSHEET_BASE_URL || "https://holysheet.soneshjain.com").replace(/\/$/, "");
const KEY = (process.env.HOLYSHEET_API_KEY || "").trim();

const LEADS_HEADERS = [
  "row_id",
  "assigned_rep_id",
  "name",
  "email",
  "phone",
  "webinar_dates",
  "attended",
  "attendance_duration_min",
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

function nanoid(size = 10) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < size; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const SAMPLE_LEADS = [
  { name: "Priya Sharma", email: "priya.s@example.com", phone: "+919876543201", webinar_dates: "2025-03-10", attended: "Y", attendance_duration_min: "52" },
  { name: "Rahul Verma", email: "rahul.v@example.com", phone: "+919876543202", webinar_dates: "2025-03-10", attended: "Y", attendance_duration_min: "45" },
  { name: "Anita Desai", email: "anita.d@example.com", phone: "+919876543203", webinar_dates: "2025-03-11", attended: "N", attendance_duration_min: "0" },
  { name: "Vikram Singh", email: "vikram.s@example.com", phone: "+919876543204", webinar_dates: "2025-03-11", attended: "Y", attendance_duration_min: "60" },
  { name: "Meera Patel", email: "meera.p@example.com", phone: "+919876543205", webinar_dates: "2025-03-12", attended: "Y", attendance_duration_min: "38" },
  { name: "Arjun Reddy", email: "arjun.r@example.com", phone: "+919876543206", webinar_dates: "2025-03-12", attended: "Y", attendance_duration_min: "55" },
  { name: "Kavita Nair", email: "kavita.n@example.com", phone: "+919876543207", webinar_dates: "2025-03-13", attended: "N", attendance_duration_min: "0" },
  { name: "Suresh Kumar", email: "suresh.k@example.com", phone: "+919876543208", webinar_dates: "2025-03-13", attended: "Y", attendance_duration_min: "42" },
  { name: "Deepa Iyer", email: "deepa.i@example.com", phone: "+919876543209", webinar_dates: "2025-03-14", attended: "Y", attendance_duration_min: "48" },
  { name: "Rajesh Gupta", email: "rajesh.g@example.com", phone: "+919876543210", webinar_dates: "2025-03-14", attended: "Y", attendance_duration_min: "50" },
];

function buildRow(lead, now) {
  return LEADS_HEADERS.map((h) => {
    switch (h) {
      case "row_id":
        return nanoid(10);
      case "assigned_rep_id":
        return "sr06";
      case "name":
        return lead.name;
      case "email":
        return lead.email;
      case "phone":
        return lead.phone;
      case "webinar_dates":
        return lead.webinar_dates;
      case "attended":
        return lead.attended;
      case "attendance_duration_min":
        return lead.attendance_duration_min;
      case "meaningful_connect":
      case "lead_quality":
      case "call_status":
      case "lead_status":
      case "remarks":
      case "plan_option":
        return "";
      case "locked_by":
      case "locked_at":
        return "";
      case "created_at":
      case "updated_at":
        return now;
      default:
        return "";
    }
  });
}

async function main() {
  if (!KEY) {
    console.error("Error: HOLYSHEET_API_KEY not set in .env");
    process.exit(1);
  }

  const now = new Date().toISOString();
  const rows = SAMPLE_LEADS.map((l) => buildRow(l, now));
  const url = `${BASE}/api/v1/${KEY}/rows?sheet=Leads`;

  console.log(`Seeding 10 leads to ${BASE}...`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Error:", data.error || res.statusText);
      process.exit(1);
    }

    console.log(`Success: appended ${data.appended ?? rows.length} row(s) to Leads sheet.`);
    console.log("Refresh the CRM to see the data.");
  } catch (err) {
    console.error("Request failed:", err.message);
    process.exit(1);
  }
}

main();
