import { NextRequest, NextResponse } from "next/server";
import { appendLead, getLeads } from "@/lib/csv-store";
import { getCurrentUser } from "@/lib/auth";
import { validateEmail, validatePhone } from "@/lib/validation";
import { LEADS_HEADERS } from "@/lib/schema";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const emailErr = validateEmail(body.email || "");
    if (emailErr)
      return NextResponse.json({ error: emailErr, field: "email" }, { status: 400 });
    const phoneErr = validatePhone(body.phone || "");
    if (phoneErr)
      return NextResponse.json({ error: phoneErr, field: "phone" }, { status: 400 });

    const now = new Date().toISOString();
    const rowId = nanoid(10);

    const row = LEADS_HEADERS.map((h) => {
      switch (h) {
        case "row_id":
          return rowId;
        case "assigned_rep_id":
          return body.assigned_rep_id ?? (user.role === "sales_rep" ? user.id : "");
        case "created_at":
        case "updated_at":
          return now;
        case "locked_by":
        case "locked_at":
          return "";
        default:
          return body[h] ?? "";
      }
    });

    const rowObj: Record<string, string> = {};
    LEADS_HEADERS.forEach((h, i) => { rowObj[h] = String(row[i] ?? ""); });
    appendLead(rowObj);
    const all = getLeads();
    const rowIndex = all.length + 1; // last row index (1-based data row)

    return NextResponse.json({
      success: true,
      row_id: rowId,
      row_index: rowIndex,
    });
  } catch (e) {
    console.error("[POST /api/leads/create]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create lead" },
      { status: 500 }
    );
  }
}
