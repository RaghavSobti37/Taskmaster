import { NextRequest, NextResponse } from "next/server";
import { getLeadByRowIndex, updateLead, appendAudit } from "@/lib/csv-store";
import { getCurrentUser, canAccessLead } from "@/lib/auth";
import { LEAD_EDITABLE_FIELDS, AUDIT_HEADERS } from "@/lib/schema";

export const dynamic = "force-dynamic";

const LOCK_TTL_MS = 5 * 60 * 1000; // 5 min

function isLockStale(lockedAt: string): boolean {
  try {
    const t = new Date(lockedAt).getTime();
    return isNaN(t) || Date.now() - t > LOCK_TTL_MS;
  } catch {
    return true;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { rowIndex: string } }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rowIndex = parseInt(params.rowIndex, 10);
    if (isNaN(rowIndex) || rowIndex < 2)
      return NextResponse.json({ error: "Invalid row index" }, { status: 400 });

    const row = getLeadByRowIndex(rowIndex);
    if (!row) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const lead = { ...row, row_index: rowIndex };
    if (!canAccessLead(user, row.assigned_rep_id || ""))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json(lead);
  } catch (e) {
    console.error("[GET /api/leads/:rowIndex]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch lead" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { rowIndex: string } }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rowIndex = parseInt(params.rowIndex, 10);
    if (isNaN(rowIndex) || rowIndex < 2)
      return NextResponse.json({ error: "Invalid row index" }, { status: 400 });

    const existing = getLeadByRowIndex(rowIndex);
    if (!existing)
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    if (!canAccessLead(user, existing.assigned_rep_id || ""))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Row locking: reject if locked by someone else and not stale
    const lockedBy = existing.locked_by || "";
    const lockedAt = existing.locked_at || "";
    if (
      lockedBy &&
      lockedBy !== user.id &&
      !isLockStale(lockedAt)
    )
      return NextResponse.json(
        { error: "Lead is being edited by another user" },
        { status: 409 }
      );

    const body = await req.json();
    const allowed = new Set(LEAD_EDITABLE_FIELDS);
    const updates: Record<string, string | number> = {};

    for (const [k, v] of Object.entries(body)) {
      if (!allowed.has(k as (typeof LEAD_EDITABLE_FIELDS)[number])) continue;
      updates[k] = v as string | number;
    }

    updates.updated_at = new Date().toISOString();

    // Audit log: one row per save so incremental sync can detect "changed since last sync"
    const now = new Date().toISOString();
    const auditRow: Record<string, string> = {};
    AUDIT_HEADERS.forEach((h) => {
      switch (h) {
        case "timestamp": auditRow[h] = now; break;
        case "user_id": auditRow[h] = user.id; break;
        case "user_role": auditRow[h] = user.role; break;
        case "lead_row_id": auditRow[h] = existing.row_id || String(rowIndex); break;
        case "field_changed": auditRow[h] = "updated"; break;
        case "old_value": auditRow[h] = ""; break;
        case "new_value": auditRow[h] = Object.keys(updates).filter((k) => k !== "updated_at").join(","); break;
        default: auditRow[h] = "";
      }
    });
    appendAudit(auditRow);

    updateLead(rowIndex, updates as Record<string, string>);

    return NextResponse.json({ success: true, row_index: rowIndex });
  } catch (e) {
    console.error("[PATCH /api/leads/:rowIndex]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update lead" },
      { status: 500 }
    );
  }
}
