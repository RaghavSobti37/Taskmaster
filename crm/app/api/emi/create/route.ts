import { NextRequest, NextResponse } from "next/server";
import { holysheetPost } from "@/lib/holysheet";
import { getCurrentUser } from "@/lib/auth";
import { EMI_SHEET, EMI_HEADERS } from "@/lib/schema";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { lead_row_id, installment_no, due_date, amount, status } = body;
    if (!lead_row_id || installment_no == null)
      return NextResponse.json(
        { error: "lead_row_id and installment_no required" },
        { status: 400 }
      );

    const now = new Date().toISOString();
    const rowId = nanoid(10);

    const row = EMI_HEADERS.map((h) => {
      switch (h) {
        case "row_id":
          return rowId;
        case "lead_row_id":
          return lead_row_id;
        case "installment_no":
          return String(installment_no);
        case "due_date":
          return due_date ?? "";
        case "amount":
          return String(amount ?? "");
        case "status":
          return status === "Paid" ? "Paid" : "Pending";
        case "paid_at":
          return status === "Paid" ? now : "";
        case "created_at":
          return now;
        default:
          return "";
      }
    });

    await holysheetPost(EMI_SHEET, [row]);
    return NextResponse.json({ success: true, row_id: rowId });
  } catch (e) {
    console.error("[POST /api/emi/create]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
