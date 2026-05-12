import type { CrmUser } from "@/lib/users";

export type ReportId = "followups_digest";

export type ReportRecipient = {
  user: CrmUser;
  email: string;
};

export type SendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

export type ReportRunContext = {
  /** YYYY-MM-DD in Asia/Kolkata */
  istDateKey: string;
  dryRun: boolean;
};

/** One line per intended recipient — see `reason` when skipped. */
export type ReportRecipientLedgerEntry = {
  audience: "org_digest" | "sdr_digest";
  userId: string;
  name: string;
  email: string;
  /** sent = mail accepted; simulated = dry run only; skipped / failed = see reason */
  result: "sent" | "simulated" | "skipped" | "failed";
  reason: string;
};

export type ReportRunResult = {
  sent: number;
  skipped: number;
  errors: string[];
  ledger: ReportRecipientLedgerEntry[];
};

export type ScheduledReport = {
  id: ReportId;
  /** Human label for logs */
  label: string;
  /** Hour (0–23) and minute in Asia/Kolkata when this report may send */
  sendAtIST: { hour: number; minute: number };
  /**
   * If true, cron only sends when current IST time is within this many minutes after sendAtIST.
   * Avoids duplicate sends if cron runs every minute.
   */
  sendWindowMinutes: number;
  run: (ctx: ReportRunContext) => Promise<ReportRunResult>;
};
