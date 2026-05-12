import { followupsDigestReport } from "./followups-digest";
import type {
  ReportRecipientLedgerEntry,
  ReportRunContext,
  ScheduledReport,
} from "./types";

export const SCHEDULED_REPORTS: ScheduledReport[] = [followupsDigestReport];

function istClock(now: Date): { dateKey: string; hour: number; minute: number } {
  const dateKey = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = parseInt(parts.find((x) => x.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((x) => x.type === "minute")?.value || "0", 10);
  return { dateKey, hour, minute };
}

function isWithinSendWindow(
  clock: { hour: number; minute: number },
  sendAt: { hour: number; minute: number },
  windowMinutes: number
): boolean {
  const start = sendAt.hour * 60 + sendAt.minute;
  const end = start + windowMinutes;
  const cur = clock.hour * 60 + clock.minute;
  return cur >= start && cur < end;
}

export type RunDueReportsOptions = {
  now?: Date;
  force?: boolean;
  dryRun?: boolean;
};

/**
 * Runs reports whose IST send window matches `now`, unless `force` is true (still respects idempotency per recipient/day unless dryRun).
 */
export async function runDueReports(
  opts: RunDueReportsOptions = {}
): Promise<{
  ran: string[];
  results: Array<{
    id: string;
    sent: number;
    skipped: number;
    errors: string[];
    ledger: ReportRecipientLedgerEntry[];
  }>;
}> {
  const now = opts.now ?? new Date();
  const clock = istClock(now);
  const ctx: ReportRunContext = {
    istDateKey: clock.dateKey,
    dryRun: !!opts.dryRun,
  };

  const ran: string[] = [];
  const results: Array<{
    id: string;
    sent: number;
    skipped: number;
    errors: string[];
    ledger: ReportRecipientLedgerEntry[];
  }> = [];

  for (const report of SCHEDULED_REPORTS) {
    const inWindow =
      opts.force ||
      isWithinSendWindow(clock, report.sendAtIST, report.sendWindowMinutes);
    if (!inWindow) continue;

    const out = await report.run(ctx);
    ran.push(report.id);
    results.push({
      id: report.id,
      sent: out.sent,
      skipped: out.skipped,
      errors: out.errors,
      ledger: out.ledger,
    });
  }

  return { ran, results };
}
