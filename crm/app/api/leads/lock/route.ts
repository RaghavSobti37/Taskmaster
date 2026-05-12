import { NextRequest, NextResponse } from "next/server";
import { holysheetGet, holysheetPatch } from "@/lib/holysheet";
import { getCurrentUser, canAccessLead } from "@/lib/auth";
import { LEADS_SHEET } from "@/lib/schema";

export const dynamic = "force-dynamic";

const LOCK_TTL_MS = 5 * 60 * 1000;

function isLockStale(lockedAt: string): boolean {
  try {
    const t = new Date(lockedAt).getTime();
    return isNaN(t) || Date.now() - t > LOCK_TTL_MS;
  } catch {
    return true;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { rowIndex } = await req.json();
    const ri = parseInt(String(rowIndex), 10);
    if (isNaN(ri) || ri < 2)
      return NextResponse.json({ error: "Invalid rowIndex" }, { status: 400 });

    const res = await holysheetGet(LEADS_SHEET);
    const data = res.data || [];
    const idx = ri - 2;
    if (idx < 0 || idx >= data.length)
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const existing = data[idx];
    if (!canAccessLead(user, existing.assigned_rep_id || ""))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const lockedBy = existing.locked_by || "";
    const lockedAt = existing.locked_at || "";
    if (lockedBy && lockedBy !== user.id && !isLockStale(lockedAt))
      return NextResponse.json(
        { error: "Lead is being edited by another user" },
        { status: 409 }
      );

    const now = new Date().toISOString();
    await holysheetPatch(ri, { locked_by: user.id, locked_at: now }, LEADS_SHEET);

    return NextResponse.json({ success: true, locked_by: user.id });
  } catch (e) {
    console.error("[POST /api/leads/lock]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to lock" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const ri = parseInt(searchParams.get("rowIndex") || "", 10);
    if (isNaN(ri) || ri < 2)
      return NextResponse.json({ error: "Invalid rowIndex" }, { status: 400 });

    const res = await holysheetGet(LEADS_SHEET);
    const data = res.data || [];
    const idx = ri - 2;
    if (idx < 0 || idx >= data.length)
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const existing = data[idx];
    if (existing.locked_by !== user.id)
      return NextResponse.json({ error: "Not locked by you" }, { status: 403 });

    await holysheetPatch(ri, { locked_by: "", locked_at: "" }, LEADS_SHEET);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/leads/lock]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to unlock" },
      { status: 500 }
    );
  }
}
