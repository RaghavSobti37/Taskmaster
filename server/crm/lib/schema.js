const LEADS_HEADERS = [
  "row_id",
  "created_at",
  "source",
  "name",
  "email",
  "phone",
  "location",
  "interest",
  "status",
  "assigned_to",
  "last_contact",
  "next_followup",
  "notes",
  "budget",
  "priority",
  "locked_by",
  "locked_at",
  "is_junk"
];

const EMI_HEADERS = [
  "row_id",
  "lead_row_id",
  "amount",
  "due_date",
  "status",
  "paid_date",
  "transaction_id",
  "notes"
];

const AUDIT_HEADERS = [
  "timestamp",
  "user_id",
  "lead_row_id",
  "field",
  "old_value",
  "new_value"
];

const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
  "Follow-up Required"
];

const LEAD_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const LEAD_SOURCES = [
  "Website",
  "Referral",
  "Cold Call",
  "LinkedIn",
  "Instagram",
  "Facebook",
  "Other"
];

module.exports = {
  LEADS_HEADERS,
  EMI_HEADERS,
  AUDIT_HEADERS,
  LEAD_STATUSES,
  LEAD_PRIORITIES,
  LEAD_SOURCES
};
