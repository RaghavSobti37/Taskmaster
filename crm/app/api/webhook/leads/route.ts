/**
 * Webhook endpoint for ingesting leads from external webinar platforms.
 * Structure: POST with { name, email, phone, webinar_dates, ... }
 * Secured via WEBHOOK_SECRET header.
 */
import { NextRequest, NextResponse } from "next/server";
import { appendLead } from "@/lib/csv-store";
import { validateEmail, validatePhone } from "@/lib/validation";
import { LEADS_HEADERS } from "@/lib/schema";
import { createRepAutoAssigner } from "@/lib/rep-assignment";

export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.CRM_WEBHOOK_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-webhook-secret");
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET)
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });

    const body = await req.json();
    const emailErr = validateEmail(body.email || "");
    if (emailErr)
      return NextResponse.json({ error: emailErr }, { status: 400 });
    const phoneErr = validatePhone(body.phone || "");
    if (phoneErr)
      return NextResponse.json({ error: phoneErr }, { status: 400 });

    const now = new Date().toISOString();
    const rowId = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const rowObj: Record<string, string> = {};
    const repAssigner = createRepAutoAssigner();
    const assignedRep = repAssigner.assign(body.assigned_rep_id);

    LEADS_HEADERS.forEach((h) => {
      switch (h) {
        case "row_id": rowObj[h] = rowId; break;
        case "assigned_rep_id":
          rowObj[h] = assignedRep.repId; break;
        case "locked_by":
        case "locked_at":
          rowObj[h] = ""; break;
        case "name": rowObj[h] = body.name ?? ""; break;
        case "email": rowObj[h] = body.email ?? ""; break;
        case "phone": rowObj[h] = body.phone ?? ""; break;
        case "webinar_dates": rowObj[h] = body.webinar_dates ?? body.webinar_date ?? ""; break;
        case "attended": rowObj[h] = body.attended ?? ""; break;
        case "attendance_duration_min": rowObj[h] = body.attendance_duration_min ?? body.attendance_duration ?? ""; break;
        case "artist_type":
        case "full_time_willingness":
        case "primary_role":
        case "learning_goal":
        case "learned_music":
        case "current_journey":
        case "qna_answered":
          rowObj[h] = body[h] ?? ""; break;
        case "meaningful_connect":
        case "lead_quality":
        case "call_status":
        case "lead_status":
        case "remarks":
        case "plan_option":
        case "customer_id_exly":
        case "transaction_id_exly":
          rowObj[h] = body[h] ?? ""; break;
        case "created_at":
        case "updated_at":
          rowObj[h] = now; break;
        default:
          rowObj[h] = body[h] ?? "";
      }
    });

    appendLead(rowObj);

    return NextResponse.json({
      success: true,
      row_id: rowId,
      message: "Lead ingested successfully",
    });
  } catch (e) {
    console.error("[POST /api/webhook/leads]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook failed" },
      { status: 500 }
    );
  }
}
