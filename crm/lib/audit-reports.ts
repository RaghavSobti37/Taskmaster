/**
 * Audit-based reports: daily activity by sales rep (lead owner) or by user (who made the edit).
 */
import { getAudit, getLeads } from "@/lib/csv-store";
import { getUserById } from "@/lib/users";

export type ReportBy = "rep" | "user";

/** YYYY-MM-DD from ISO timestamp */
function dateKey(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** lead_row_id -> assigned_rep_id from leads */
function getLeadToRepMap(): Map<string, string> {
  const leads = getLeads();
  const map = new Map<string, string>();
  for (const l of leads) {
    const rid = l.row_id ?? "";
    const rep = (l.assigned_rep_id ?? "").trim();
    if (rid) map.set(rid, rep || "(unassigned)");
  }
  return map;
}

export interface DailyRepRow {
  repId: string;
  repName: string;
  edits: number;
  uniqueLeads: number;
  byField: Record<string, Record<string, number>>;
}

export interface DailyUserRow {
  userId: string;
  userName: string;
  edits: number;
  uniqueLeads: number;
  byField: Record<string, Record<string, number>>;
}

/** Daily report grouped by assigned_rep_id (owner of the lead that was edited). */
export function getDailyReportByRep(date: string): DailyRepRow[] {
  const leadToRep = getLeadToRepMap();
  const audit = getAudit();
  const day = date.slice(0, 10);

  const byRep = new Map<
    string,
    { edits: number; leads: Set<string>; byField: Record<string, Record<string, number>> }
  >();

  for (const r of audit) {
    const ts = r.timestamp ?? "";
    if (dateKey(ts) !== day) continue;
    const leadId = r.lead_row_id ?? "";
    const repId = leadToRep.get(leadId) ?? "(unknown)";
    const field = r.field_changed ?? "updated";
    const newVal = (r.new_value ?? "").trim() || "(empty)";

    let row = byRep.get(repId);
    if (!row) {
      row = { edits: 0, leads: new Set(), byField: {} };
      byRep.set(repId, row);
    }
    row.edits++;
    row.leads.add(leadId);
    if (!row.byField[field]) row.byField[field] = {};
    row.byField[field][newVal] = (row.byField[field][newVal] ?? 0) + 1;
  }

  return Array.from(byRep.entries())
    .map(([repId, row]) => ({
      repId,
      repName: repId === "(unassigned)" || repId === "(unknown)" ? repId : (getUserById(repId)?.name ?? repId),
      edits: row.edits,
      uniqueLeads: row.leads.size,
      byField: row.byField,
    }))
    .sort((a, b) => b.edits - a.edits);
}

/** Daily report grouped by user_id (who made the edit). */
export function getDailyReportByUser(date: string): DailyUserRow[] {
  const audit = getAudit();
  const day = date.slice(0, 10);

  const byUser = new Map<
    string,
    { edits: number; leads: Set<string>; byField: Record<string, Record<string, number>> }
  >();

  for (const r of audit) {
    const ts = r.timestamp ?? "";
    if (dateKey(ts) !== day) continue;
    const userId = r.user_id ?? "(unknown)";
    const leadId = r.lead_row_id ?? "";
    const field = r.field_changed ?? "updated";
    const newVal = (r.new_value ?? "").trim() || "(empty)";

    let row = byUser.get(userId);
    if (!row) {
      row = { edits: 0, leads: new Set(), byField: {} };
      byUser.set(userId, row);
    }
    row.edits++;
    row.leads.add(leadId);
    if (!row.byField[field]) row.byField[field] = {};
    row.byField[field][newVal] = (row.byField[field][newVal] ?? 0) + 1;
  }

  return Array.from(byUser.entries())
    .map(([userId, row]) => ({
      userId,
      userName: getUserById(userId)?.name ?? userId,
      edits: row.edits,
      uniqueLeads: row.leads.size,
      byField: row.byField,
    }))
    .sort((a, b) => b.edits - a.edits);
}
