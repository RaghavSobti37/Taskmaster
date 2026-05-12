import { NextRequest, NextResponse } from "next/server";
import { runDueReports } from "@/lib/reports/registry";
import { isMailConfigured } from "@/lib/reports/mailer";

export const dynamic = "force-dynamic";

/**
 * Daily scheduled reports (IST). Secure with CRM_CRON_SECRET.
 *
 * Suggested: call at 01:35 UTC (= 07:05 IST) via Vercel Cron or system cron:
 *   curl -X POST -H "Authorization: Bearer $CRM_CRON_SECRET" https://host/crm/api/cron/reports
 *
 * Query: force=1 — ignore IST time window (still idempotent per recipient/day).
 * Query: dry=1 — build counts only, do not send mail or write sent log.
 */
export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const secret = process.env.CRM_CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "CRM_CRON_SECRET not configured" },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const qSecret = req.nextUrl.searchParams.get("secret") || "";
  if (bearer !== secret && qSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";

  if (!dryRun && !isMailConfigured()) {
    return NextResponse.json(
      { error: "Mail not configured (CRM_SMTP_* and CRM_DIGEST_FROM)" },
      { status: 503 }
    );
  }

  try {
    const { ran, results } = await runDueReports({ force, dryRun });
    return NextResponse.json({
      ok: true,
      ran,
      results,
      dryRun,
 });
  } catch (e) {
    console.error("[cron/reports]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Run failed" },
      { status: 500 }
    );
  }
}
