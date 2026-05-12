import { NextRequest, NextResponse } from "next/server";
import { getAuditByLead } from "@/lib/csv-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const leadRowId = searchParams.get("lead_row_id");
    if (!leadRowId)
      return NextResponse.json(
        { error: "lead_row_id required" },
        { status: 400 }
      );

    const data = getAuditByLead(leadRowId);
    return NextResponse.json({ data });
  } catch (e) {
    console.error("[GET /api/audit]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
