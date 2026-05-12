/**
 * Import leads from CSV/JSON into the Leads sheet.
 * Auto-generates: row_id, created_at, updated_at.
 * Expects: name, email, phone, webinar_dates, attended, attendance_duration_min.
 * Admin only.
 */
import { NextRequest, NextResponse } from "next/server";
import { appendAudit, appendLeads, getLeads } from "@/lib/csv-store";
import { getCurrentUser } from "@/lib/auth";
import { validateEmail, validatePhone } from "@/lib/validation";
import { AUDIT_HEADERS, LEADS_HEADERS } from "@/lib/schema";
import { createRepAutoAssigner, SDR_IDS } from "@/lib/rep-assignment";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

type ImportRow = {
  name?: string;
  email?: string;
  phone?: string;
  webinar_dates?: string;
  attended?: string;
  attendance_duration_min?: string;
  assigned_rep_id?: string;
  artist_type?: string;
  full_time_willingness?: string;
  primary_role?: string;
  learning_goal?: string;
  current_journey?: string;
  learned_music?: string;
  qna_answered?: string;
  customer_id_exly?: string;
  transaction_id_exly?: string;
  call_status?: string;
  lead_quality?: string;
  lead_status?: string;
  remarks?: string;
};

const COLUMN_MAP: Record<string, keyof ImportRow> = {
  name: "name",
  email: "email",
  phone: "phone",
  contact_number: "phone",
  contact: "phone",
  webinar_dates: "webinar_dates",
  webinar_date: "webinar_dates",
  attended: "attended",
  attendance_duration_min: "attendance_duration_min",
  attendance_duration: "attendance_duration_min",
  assigned_rep_id: "assigned_rep_id",
  assigned_rep: "assigned_rep_id",
  artist_type: "artist_type",
  full_time_willingness: "full_time_willingness",
  primary_role: "primary_role",
  learning_goal: "learning_goal",
  current_journey: "current_journey",
  customer_id_exly: "customer_id_exly",
  transaction_id_exly: "transaction_id_exly",
  learned_music: "learned_music",
  qna_answered: "qna_answered",
};

function parseCsv(csvText: string): ImportRow[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const row: ImportRow = {};
    headers.forEach((h, idx) => {
      const v = vals[idx]?.trim() ?? "";
      const key = COLUMN_MAP[h];
      if (key) (row as Record<string, string>)[key] = v;
    });
    if (row.email || row.phone || row.name) rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      current += c;
    } else if (c === ",") {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

function normalizeText(raw: string | number): string {
  return String(raw || "").trim().toLowerCase();
}

function dedupeKeysForLead(
  lead: Record<string, string | number | undefined>
): string[] {
  const keys: string[] = [];
  const customerId = normalizeText(lead.customer_id_exly || "");
  const txnId = normalizeText(lead.transaction_id_exly || "");
  const phone = normalizeText(lead.phone || "");
  const webinar = normalizeText(lead.webinar_dates || "");
  const email = normalizeText(lead.email || "");

  if (customerId) keys.push(`customer:${customerId}`);
  if (txnId) keys.push(`txn:${txnId}`);
  if (phone && webinar) keys.push(`phone_webinar:${phone}|${webinar}`);
  if (email && webinar) keys.push(`email_webinar:${email}|${webinar}`);

  return keys;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "super_admin")
      return NextResponse.json({ error: "Super Admin only" }, { status: 403 });

    let rows: ImportRow[];
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("text/csv")) {
      const csvText = await req.text();
      rows = parseCsv(csvText);
    } else {
      const body = await req.json();
      rows = Array.isArray(body.rows) ? body.rows : body.data ? body.data : [body];
    }

    if (rows.length === 0)
      return NextResponse.json({ error: "No rows to import" }, { status: 400 });

    const existingLeads = getLeads();
    const existingKeys = new Set<string>();
    for (const lead of existingLeads) {
      for (const k of dedupeKeysForLead(lead)) existingKeys.add(k);
    }

    const now = new Date().toISOString();
    const toAppend: Record<string, string>[] = [];
    const repAssigner = createRepAutoAssigner(existingLeads);
    const distribution: Record<string, number> = Object.fromEntries(
      SDR_IDS.map((id) => [id, 0])
    );
    let autoAssigned = 0;
    let invalid = 0;
    let duplicates = 0;

    for (const r of rows) {
      const email = String(r.email ?? "").trim();
      const phone = String(r.phone ?? "").trim();
      if (email) {
        const err = validateEmail(email);
        if (err) {
          invalid++;
          continue;
        }
      }
      if (phone) {
        const err = validatePhone(phone);
        if (err) {
          invalid++;
          continue;
        }
      }

      const rowKeys = dedupeKeysForLead({
        customer_id_exly: r.customer_id_exly,
        transaction_id_exly: r.transaction_id_exly,
        phone,
        webinar_dates: r.webinar_dates,
        email,
      });
      if (rowKeys.length > 0 && rowKeys.some((k) => existingKeys.has(k))) {
        duplicates++;
        continue;
      }

      const rowObj: Record<string, string> = {};
      const assignedRep = repAssigner.assign(r.assigned_rep_id);
      if (assignedRep.autoAssigned) autoAssigned++;
      distribution[assignedRep.repId] = (distribution[assignedRep.repId] ?? 0) + 1;
      LEADS_HEADERS.forEach((h) => {
        switch (h) {
          case "row_id": rowObj[h] = nanoid(10); break;
          case "assigned_rep_id": rowObj[h] = assignedRep.repId; break;
          case "name": rowObj[h] = r.name ?? ""; break;
          case "email": rowObj[h] = email; break;
          case "phone": rowObj[h] = phone; break;
          case "webinar_dates": rowObj[h] = r.webinar_dates ?? ""; break;
          case "attended": rowObj[h] = r.attended ?? ""; break;
          case "attendance_duration_min": rowObj[h] = r.attendance_duration_min ?? ""; break;
          case "artist_type":
          case "full_time_willingness":
          case "primary_role":
          case "learning_goal":
          case "learned_music":
          case "current_journey":
          case "qna_answered":
            rowObj[h] = (r as Record<string, string>)[h] ?? ""; break;
          case "meaningful_connect":
          case "lead_quality":
          case "call_status":
          case "lead_status":
          case "remarks":
          case "plan_option":
          case "customer_id_exly":
          case "transaction_id_exly":
            rowObj[h] = (r as Record<string, string>)[h] ?? ""; break;
          case "locked_by":
          case "locked_at":
            rowObj[h] = ""; break;
          case "created_at":
          case "updated_at":
            rowObj[h] = now; break;
          default:
            rowObj[h] = "";
        }
      });
      toAppend.push(rowObj);
      rowKeys.forEach((k) => existingKeys.add(k));
    }

    if (toAppend.length === 0)
      return NextResponse.json({
        error: "No importable rows (invalid format or duplicates)",
        attempted: rows.length,
        invalid,
        duplicates,
      }, { status: 400 });

    appendLeads(toAppend);

    const importBatchId = `import_${Date.now()}`;
    const auditRow: Record<string, string> = {};
    AUDIT_HEADERS.forEach((h) => {
      switch (h) {
        case "timestamp":
          auditRow[h] = now;
          break;
        case "user_id":
          auditRow[h] = user.id;
          break;
        case "user_role":
          auditRow[h] = user.role;
          break;
        case "lead_row_id":
          auditRow[h] = importBatchId;
          break;
        case "field_changed":
          auditRow[h] = "import_batch";
          break;
        case "old_value":
          auditRow[h] = "";
          break;
        case "new_value":
          auditRow[h] = `attempted=${rows.length};imported=${toAppend.length};invalid=${invalid};duplicates=${duplicates};auto_assigned=${autoAssigned}`;
          break;
        default:
          auditRow[h] = "";
      }
    });
    appendAudit(auditRow);

    return NextResponse.json({
      success: true,
      attempted: rows.length,
      imported: toAppend.length,
      skipped: invalid + duplicates,
      invalid,
      duplicates,
      auto_assigned: autoAssigned,
      distribution,
      final_rep_loads: repAssigner.getCurrentCounts(),
      import_batch_id: importBatchId,
    });
  } catch (e) {
    console.error("[POST /api/import/leads]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    );
  }
}
