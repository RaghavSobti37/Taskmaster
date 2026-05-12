export type MeaningfulConnect = "YES" | "NO";
export type LeadQuality = "4" | "3" | "2" | "1" | "Future 4";
export type CallStatus =
  | "DNP"
  | "Switch Off/Wrong Number"
  | "Busy"
  | "Connected";
export type LeadStatus =
  | "Not Interested"
  | "Cold"
  | "Warm"
  | "Hot"
  | "Token Received"
  | "Converted";
export type PlanOption = "One-Time" | "3 Mo" | "6 Mo" | "9 Mo" | "";
export type Attended = "Y" | "N" | "";
export type EmiStatus = "Paid" | "Pending";

export interface Lead {
  row_id: string;
  row_index: number; // 1-based sheet row (2 = first data row)
  assigned_rep_id: string;
  name: string;
  email: string;
  phone: string;
  webinar_dates: string;
  attended: Attended;
  attendance_duration_min: string;
  meaningful_connect: MeaningfulConnect | "";
  lead_quality: LeadQuality | "";
  call_status: CallStatus | "";
  lead_status: LeadStatus | "";
  remarks: string;
  next_followup_date: string;
  next_followup_time: string;
  plan_option: PlanOption;
  locked_by: string;
  locked_at: string;
  created_at: string;
  updated_at: string;
}

export interface EmiInstallment {
  row_id: string;
  lead_row_id: string;
  installment_no: number;
  due_date: string;
  amount: string;
  status: EmiStatus;
  paid_at: string;
  created_at: string;
}

export interface AuditEntry {
  timestamp: string;
  user_id: string;
  user_role: string;
  lead_row_id: string;
  field_changed: string;
  old_value: string;
  new_value: string;
}

export type UserRole = "super_admin" | "team_leader" | "sales_rep";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
