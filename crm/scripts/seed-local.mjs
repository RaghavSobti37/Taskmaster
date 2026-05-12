#!/usr/bin/env node
/**
 * Seed local CSV with sample leads. Run: node scripts/seed-local.mjs
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../data");
const LEADS_PATH = join(DATA_DIR, "leads.csv");

const LEADS_HEADERS = [
  "row_id", "assigned_rep_id", "name", "email", "phone",
  "webinar_dates", "attended", "attendance_duration_min",
  "meaningful_connect", "lead_quality", "call_status", "lead_status",
  "remarks", "plan_option", "locked_by", "locked_at", "created_at", "updated_at",
];

function nanoid(size = 10) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < size; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function escape(val) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const SAMPLE = [
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

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

let content = LEADS_HEADERS.join(",") + "\n";
const now = new Date().toISOString();

for (const l of SAMPLE) {
  const row = [
    nanoid(10), "sr06", l.name, l.email, l.phone,
    l.webinar_dates || "", l.attended || "", l.attendance_duration_min || "",
    "", "", "", "", "", "", "", "", now, now,
  ];
  content += row.map(escape).join(",") + "\n";
}

writeFileSync(LEADS_PATH, content, "utf8");
console.log(`Seeded ${SAMPLE.length} leads to ${LEADS_PATH}`);
