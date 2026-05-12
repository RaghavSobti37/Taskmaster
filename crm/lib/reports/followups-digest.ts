import { getLeads } from "@/lib/csv-store";
import { followupBucketIST, parseFollowupAtInIST } from "@/lib/followup-utils";
import {
  getUserById,
  normalizeAssignedRepToId,
  getRepDisplayName,
  FOLLOWUPS_DIGEST_ORG_RECIPIENT_IDS,
  FOLLOWUPS_DIGEST_SDR_IDS,
  type CrmUser,
} from "@/lib/users";
import { sendReportEmail } from "./mailer";
import { recordSent, wasAlreadySent } from "./sent-log";
import type {
  ReportRunContext,
  ReportRecipientLedgerEntry,
  ReportRunResult,
  ScheduledReport,
} from "./types";

type LeadRow = Record<string, string> & { row_index?: number };

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function crmBaseUrl(): string {
  const b = (process.env.CRM_PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
  return b || "";
}

function leadHref(row: LeadRow): string {
  const base = crmBaseUrl();
  const idx = row.row_index ?? 0;
  if (!base) return `#lead-${idx}`;
  return `${base}/leads/${idx}`;
}

function formatWhen(lead: LeadRow): string {
  const at = parseFollowupAtInIST(lead);
  if (!at) return "—";
  return at.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function sortByFollowupTime(a: LeadRow, b: LeadRow): number {
  const ta = parseFollowupAtInIST(a)?.getTime() ?? 0;
  const tb = parseFollowupAtInIST(b)?.getTime() ?? 0;
  return ta - tb;
}

function partitionBuckets(leads: LeadRow[], now: Date) {
  const overdue: LeadRow[] = [];
  const today: LeadRow[] = [];
  const upcoming: LeadRow[] = [];
  const unscheduled: LeadRow[] = [];
  for (const l of leads) {
    const b = followupBucketIST(l, now);
    if (b === "unscheduled") unscheduled.push(l);
    else if (b === "overdue") overdue.push(l);
    else if (b === "today") today.push(l);
    else upcoming.push(l);
  }
  overdue.sort(sortByFollowupTime);
  today.sort(sortByFollowupTime);
  upcoming.sort(sortByFollowupTime);
  return { overdue, today, upcoming, unscheduled };
}

function rowTable(rows: LeadRow[], opts?: { showAssignedRep?: boolean }): string {
  if (rows.length === 0)
    return `<p style="margin:8px 0;color:#64748b;font-size:14px;">None</p>`;
  const repCol = opts?.showAssignedRep
    ? "<th align=\"left\">Rep</th>"
    : "";
  const head =
    "<table cellpadding=\"8\" cellspacing=\"0\" style=\"border-collapse:collapse;width:100%;font-size:14px;\">" +
    "<thead><tr style=\"background:#f1f5f9;\">" +
    "<th align=\"left\">Lead</th>" +
    repCol +
    "<th align=\"left\">When (IST)</th><th align=\"left\">Status</th><th align=\"left\">Open</th>" +
    "</tr></thead><tbody>";
  const body = rows
    .map((l) => {
      const name = l.name || "—";
      const st = l.lead_status || "—";
      const repCell = opts?.showAssignedRep
        ? `<td>${esc(getRepDisplayName(l.assigned_rep_id ?? ""))}</td>`
        : "";
      return (
        `<tr style="border-bottom:1px solid #e2e8f0;">` +
        `<td>${esc(name)}</td>` +
        repCell +
        `<td>${esc(formatWhen(l))}</td>` +
        `<td>${esc(st)}</td>` +
        `<td><a href="${esc(leadHref(l))}">View</a></td>` +
        `</tr>`
      );
    })
    .join("");
  return head + body + "</tbody></table>";
}

function section(title: string, rows: LeadRow[], opts?: { showAssignedRep?: boolean }): string {
  return (
    `<h2 style="font-size:16px;margin:20px 0 8px;color:#0f172a;">${esc(title)} (${rows.length})</h2>` +
    rowTable(rows, opts)
  );
}

function wrapEmail(inner: string, title: string): string {
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui,sans-serif;color:#334155;line-height:1.5;max-width:720px;margin:0 auto;padding:16px;">` +
    `<h1 style="font-size:18px;color:#0f172a;">${esc(title)}</h1>` +
    `<p style="font-size:13px;color:#64748b;">TSC CRM · Morning digest · Times in IST</p>` +
    inner +
    `<p style="margin-top:24px;font-size:12px;color:#94a3b8;">This is an automated message from TSC Academy.</p>` +
    `</body></html>`
  );
}

function leadsForRepId(leads: LeadRow[], repId: string): LeadRow[] {
  return leads.filter((l) => normalizeAssignedRepToId(l.assigned_rep_id ?? "") === repId);
}

function ledgerEntry(
  partial: Omit<ReportRecipientLedgerEntry, "result" | "reason"> & {
    result: ReportRecipientLedgerEntry["result"];
    reason: string;
  }
): ReportRecipientLedgerEntry {
  return {
    audience: partial.audience,
    userId: partial.userId,
    name: partial.name,
    email: partial.email,
    result: partial.result,
    reason: partial.reason,
  };
}

async function runFollowupsDigest(ctx: ReportRunContext): Promise<ReportRunResult> {
  const reportId = "followups_digest";
  const now = new Date();
  const allLeads = getLeads() as LeadRow[];
  const sdrList = FOLLOWUPS_DIGEST_SDR_IDS.map((id) => getUserById(id)).filter(
    (u): u is CrmUser => !!u && u.role === "sales_rep" && !!u.email?.trim()
  );
  const orgRecipients = FOLLOWUPS_DIGEST_ORG_RECIPIENT_IDS.map((id) => getUserById(id)).filter(
    (u): u is CrmUser => !!u && u.role === "super_admin" && !!u.email?.trim()
  );

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const ledgerEntries: ReportRecipientLedgerEntry[] = [];

  const pAll = partitionBuckets(allLeads, now);
  /** Org email only covers scheduled buckets (excludes “no follow-up date” — too noisy). */
  const orgScheduledTotal =
    pAll.overdue.length + pAll.today.length + pAll.upcoming.length;
  const orgInner =
    orgScheduledTotal > 0
      ? section("Overdue (all leads)", pAll.overdue, { showAssignedRep: true }) +
        section("Due today (all leads)", pAll.today, { showAssignedRep: true }) +
        section("Upcoming (all leads)", pAll.upcoming, { showAssignedRep: true })
      : "";
  const orgSubject = `[TSC CRM] Org follow-ups — ${ctx.istDateKey}`;

  for (const orgUser of orgRecipients) {
    const em = orgUser.email.trim();
    if (orgScheduledTotal === 0) {
      ledgerEntries.push(
        ledgerEntry({
          audience: "org_digest",
          userId: orgUser.id,
          name: orgUser.name,
          email: em,
          result: "skipped",
          reason:
            "no scheduled org follow-ups (overdue / due today / upcoming all empty; unscheduled leads omitted from this digest)",
        })
      );
      skipped++;
      continue;
    }
    const html = wrapEmail(
      orgInner,
      `Hi ${orgUser.name}, here is the org-wide follow-up digest`
    );
    if (!ctx.dryRun && wasAlreadySent(reportId, ctx.istDateKey, em)) {
      ledgerEntries.push(
        ledgerEntry({
          audience: "org_digest",
          userId: orgUser.id,
          name: orgUser.name,
          email: em,
          result: "skipped",
          reason: `already recorded for IST date ${ctx.istDateKey} (idempotency)`,
        })
      );
      skipped++;
    } else if (ctx.dryRun) {
      ledgerEntries.push(
        ledgerEntry({
          audience: "org_digest",
          userId: orgUser.id,
          name: orgUser.name,
          email: em,
          result: "simulated",
          reason: "dry run — no mail sent; would send org digest",
        })
      );
      sent++;
    } else {
      const r = await sendReportEmail({ to: em, subject: orgSubject, html });
      if (r.ok) {
        recordSent(reportId, ctx.istDateKey, em);
        ledgerEntries.push(
          ledgerEntry({
            audience: "org_digest",
            userId: orgUser.id,
            name: orgUser.name,
            email: em,
            result: "sent",
            reason: "email sent",
          })
        );
        sent++;
      } else {
        ledgerEntries.push(
          ledgerEntry({
            audience: "org_digest",
            userId: orgUser.id,
            name: orgUser.name,
            email: em,
            result: "failed",
            reason: r.error,
          })
        );
        errors.push(`${em}: ${r.error}`);
      }
    }
  }

  for (const user of sdrList) {
    const mine = leadsForRepId(allLeads, user.id);
    const p = partitionBuckets(mine, now);
    const total =
      p.overdue.length + p.today.length + p.upcoming.length + p.unscheduled.length;
    if (total === 0) {
      ledgerEntries.push(
        ledgerEntry({
          audience: "sdr_digest",
          userId: user.id,
          name: user.name,
          email: user.email,
          result: "skipped",
          reason: "no assigned leads in any follow-up bucket",
        })
      );
      skipped++;
      continue;
    }
    const inner =
      section("Overdue", p.overdue) +
      section("Due today", p.today) +
      section("Upcoming", p.upcoming) +
      section("No follow-up date set (please schedule)", p.unscheduled);
    const subject = `[TSC CRM] Your follow-ups — ${ctx.istDateKey}`;
    const html = wrapEmail(inner, `Hi ${user.name}, here are your follow-ups`);

    if (!ctx.dryRun && wasAlreadySent(reportId, ctx.istDateKey, user.email)) {
      ledgerEntries.push(
        ledgerEntry({
          audience: "sdr_digest",
          userId: user.id,
          name: user.name,
          email: user.email,
          result: "skipped",
          reason: `already recorded for IST date ${ctx.istDateKey} (idempotency)`,
        })
      );
      skipped++;
      continue;
    }
    if (ctx.dryRun) {
      ledgerEntries.push(
        ledgerEntry({
          audience: "sdr_digest",
          userId: user.id,
          name: user.name,
          email: user.email,
          result: "simulated",
          reason: "dry run — no mail sent; would send SDR digest",
        })
      );
      sent++;
      continue;
    }
    const r = await sendReportEmail({ to: user.email, subject, html });
    if (r.ok) {
      recordSent(reportId, ctx.istDateKey, user.email);
      ledgerEntries.push(
        ledgerEntry({
          audience: "sdr_digest",
          userId: user.id,
          name: user.name,
          email: user.email,
          result: "sent",
          reason: "email sent",
        })
      );
      sent++;
    } else {
      ledgerEntries.push(
        ledgerEntry({
          audience: "sdr_digest",
          userId: user.id,
          name: user.name,
          email: user.email,
          result: "failed",
          reason: r.error,
        })
      );
      errors.push(`${user.email}: ${r.error}`);
    }
  }

  return { sent, skipped, errors, ledger: ledgerEntries };
}

export const followupsDigestReport: ScheduledReport = {
  id: "followups_digest",
  label: "Morning follow-ups digest",
  sendAtIST: { hour: 7, minute: 0 },
  sendWindowMinutes: 45,
  run: runFollowupsDigest,
};

