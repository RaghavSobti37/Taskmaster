import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDailyReportByRep, getDailyReportByUser, type ReportBy } from "@/lib/audit-reports";

export const dynamic = "force-dynamic";

/** GET /api/reports/daily?date=YYYY-MM-DD&by=rep|user */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const by = (searchParams.get("by") || "rep") as ReportBy;
    const date = dateParam ?? new Date().toISOString().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return NextResponse.json({ error: "Invalid date (use YYYY-MM-DD)" }, { status: 400 });

    if (by === "user") {
      const rows = getDailyReportByUser(date);
      return NextResponse.json({ date, by: "user", rows });
    }
    const rows = getDailyReportByRep(date);
    return NextResponse.json({ date, by: "rep", rows });
  } catch (e) {
    console.error("[GET /api/reports/daily]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Report failed" },
      { status: 500 }
    );
  }
}
