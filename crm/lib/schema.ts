/**
 * HolySheet schema for CRM - Google Sheets column layout.
 * Sheet names: Leads, EMI_Tracking, Audit_Log
 */

export const LEADS_SHEET = "Leads";
export const EMI_SHEET = "EMI_Tracking";
export const AUDIT_SHEET = "Audit_Log";

/** Lead row headers - order matters for append (matches Google Sheet) */
export const LEADS_HEADERS = [
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
  "next_followup_date",
  "next_followup_time",
  "plan_option",
  "locked_by",
  "locked_at",
  "created_at",
  "updated_at",
] as const;

export type LeadHeader = (typeof LEADS_HEADERS)[number];

/** Auto-generated: system sets these; sales rep cannot edit */
export const LEAD_AUTO_FIELDS = [
  "row_id",
  "created_at",
  "updated_at",
] as const;

/** System-managed: row locking; not user-editable */
export const LEAD_SYSTEM_FIELDS = ["locked_by", "locked_at"] as const;

/** Sales rep can edit these via CRM (source/artist fields are read-only) */
export const LEAD_EDITABLE_FIELDS = [
  "assigned_rep_id",
  "meaningful_connect",
  "lead_quality",
  "call_status",
  "lead_status",
  "remarks",
  "next_followup_date",
  "next_followup_time",
  "plan_option",
] as const;

/** Sales funnel enums */
export const ENUMS = {
  artist_type: ["Full Time", "Part Time", "Hobbyist"] as const,
  full_time_willingness: ["Yes", "No", "Maybe"] as const,
  meaningful_connect: ["YES", "NO"] as const,
  lead_quality: ["4", "3", "2", "1", "Future 4"] as const,
  call_status: [
    "DNP",
    "Switch Off/Wrong Number",
    "Busy",
    "Connected",
  ] as const,
  lead_status: [
    "Not Interested",
    "Cold",
    "Warm",
    "Hot",
    "Token Received",
    "Converted",
  ] as const,
  plan_option: ["One-Time", "3 Mo", "6 Mo", "9 Mo", ""] as const,
  attended: ["Y", "N", ""] as const,
} as const;

/** EMI tracking columns */
export const EMI_HEADERS = [
  "row_id",
  "lead_row_id",
  "installment_no",
  "due_date",
  "amount",
  "status",
  "paid_at",
  "created_at",
] as const;

export type EmiHeader = (typeof EMI_HEADERS)[number];

export const EMI_STATUS = ["Paid", "Pending"] as const;

/** Audit log columns */
export const AUDIT_HEADERS = [
  "timestamp",
  "user_id",
  "user_role",
  "lead_row_id",
  "field_changed",
  "old_value",
  "new_value",
] as const;
