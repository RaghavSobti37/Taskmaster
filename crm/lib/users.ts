/**
 * CRM users and roles. Super Admin / Team Leader / Sales Rep.
 * Passkey = last 5 digits of phone (or AEIOU for fallback).
 */
export type Role = "super_admin" | "team_leader" | "sales_rep";

export interface CrmUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  /** Sales rep IDs this team leader oversees */
  team?: string[];
}

export const USERS: CrmUser[] = [
  { id: "sr01", name: "Rohit Sobti", email: "rohith@theshakticollective.in", phone: "9819140003", role: "super_admin" },
  { id: "sr02", name: "Deepank Soni", email: "deepank@theshakticollective.in", phone: "9929459300", role: "super_admin" },
  { id: "sr03", name: "Rinki Roy", email: "ops@theshakticollective.in", phone: "8879238025", role: "super_admin" },
  { id: "sr04", name: "Raghav Sobti", email: "raghavsobti37@gmail.com", phone: "8591499393", role: "super_admin" },
  { id: "sr05", name: "Sonesh Jain", email: "tscacademy@theshakticollective.in", phone: "7895211541", role: "super_admin" },
  { id: "sr06", name: "Satyam Mishra", email: "satyam@theshakticollective.in", phone: "7977212805", role: "sales_rep" },
  { id: "sr07", name: "Shivam Sahijwani", email: "shivam@theshakticollective.in", phone: "9930341318", role: "sales_rep" },
  { id: "sr08", name: "Harshika Kasliwal", email: "harshika@theshakticollective.in", phone: "7230993707", role: "sales_rep" },
  { id: "sr09", name: "Aryaman", email: "aryaman@theshakticollective.in", phone: "9871622292", role: "sales_rep" },
];

/** Super-admins who receive the org-wide follow-up digest (all leads), one email each. */
export const FOLLOWUPS_DIGEST_ORG_RECIPIENT_IDS: readonly string[] = ["sr01", "sr05"];

/** SDR user ids who receive the per-rep follow-up digest (must match USERS). */
export const FOLLOWUPS_DIGEST_SDR_IDS: readonly string[] = [
  "sr06",
  "sr07",
  "sr08",
  "sr09",
];

/** Passkey -> user. Last 5 of phone. AEIOU = first super_admin. */
const PASSKEY_MAP: Record<string, CrmUser> = {};

function buildPasskeyMap() {
  for (const u of USERS) {
    const digits = u.phone.replace(/\D/g, "").slice(-5);
    if (digits && !PASSKEY_MAP[digits]) PASSKEY_MAP[digits] = u;
  }
  const aeiou = USERS.find((u) => u.role === "super_admin");
  if (aeiou) PASSKEY_MAP["aeiou"] = aeiou;
}

buildPasskeyMap();

export function getUserByPasskey(passkey: string): CrmUser | null {
  const key = String(passkey || "").trim().toLowerCase();
  return PASSKEY_MAP[key] ?? null;
}

export function getUserById(id: string): CrmUser | null {
  return USERS.find((u) => u.id === id) ?? null;
}

/** Users that can be assigned as reps (for dropdown) */
export function getAssignableUsers(): CrmUser[] {
  return USERS.filter((u) => u.role === "sales_rep" || u.role === "team_leader" || u.role === "super_admin");
}

/** Map rep id, full name, or first name to canonical id (for filter/display). */
const REP_TO_ID: Record<string, string> = {};
(function () {
  for (const u of USERS) {
    REP_TO_ID[u.id] = u.id;
    REP_TO_ID[u.name] = u.id;
    const first = u.name.split(" ")[0];
    if (first) REP_TO_ID[first] = u.id;
  }
})();

/** Normalize assigned_rep_id (may be "Shivam", "sr07", or "Shivam Sahijwani") to canonical id. */
export function normalizeAssignedRepToId(raw: string): string {
  const k = (raw ?? "").trim();
  return REP_TO_ID[k] ?? k;
}

/** Display name for a rep (id or name); use in lists and filters. */
export function getRepDisplayName(raw: string): string {
  const id = normalizeAssignedRepToId(raw);
  const u = getUserById(id);
  return u ? u.name : (raw || "—");
}
