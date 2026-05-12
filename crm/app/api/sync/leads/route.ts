/**
 * Manual sync: push local CSV leads to Google Sheet.
 * Sonesh (sr05) only.
 *
 * Query params:
 *   delay=150 - Ms delay between requests (default 100) to avoid rate limits
 *   incremental=1 (default) - Only append new rows + patch rows changed since last sync (audit-based)
 *   full=1 - Patch every existing row (heavy; use only for one-off catch-up)
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getLeads, getLeadRowIdsChangedSince } from "@/lib/csv-store";
import { getLastLeadsSyncAt, setLastLeadsSyncAt } from "@/lib/sync-state";
import { holysheetGet, holysheetPost, holysheetPatch } from "@/lib/holysheet";
import { LEADS_SHEET, LEADS_HEADERS } from "@/lib/schema";

export const dynamic = "force-dynamic";

const SYNC_USER_ID = "sr05";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.id !== SYNC_USER_ID)
      return NextResponse.json({ error: "Sync allowed for Sonesh only" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const delayMs = Math.min(500, Math.max(0, parseInt(searchParams.get("delay") || "100", 10)));
    const full = searchParams.get("full") === "1";
    const incremental = !full;

    const rows = getLeads();
    const res = await holysheetGet(LEADS_SHEET);
    const sheetData = (res.data || []) as Record<string, string>[];

    const rowIdToIndex = new Map<string, number>();
    sheetData.forEach((r, i) => {
      const rid = r.row_id || "";
      if (rid && !rowIdToIndex.has(rid)) rowIdToIndex.set(rid, i + 2);
    });

    const lastSync = getLastLeadsSyncAt();
    const changedSet = incremental && lastSync ? getLeadRowIdsChangedSince(lastSync) : null;

    let appended = 0;
    let updated = 0;
    let updateFailed = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowId = r.row_id || "";
      const sheetIdx = rowId ? rowIdToIndex.get(rowId) : undefined;

      if (sheetIdx != null) {
        if (incremental && changedSet !== null && !changedSet.has(rowId)) {
          skipped++;
          continue;
        }
        const values: Record<string, string> = {};
        LEADS_HEADERS.forEach((h) => {
          values[h] = r[h] ?? "";
        });
        try {
          await holysheetPatch(sheetIdx, values, LEADS_SHEET);
          updated++;
          if (delayMs) await sleep(delayMs);
        } catch (err) {
          console.error("[sync] patch failed for row_id", rowId, err);
          updateFailed++;
        }
        continue;
      }

      const vals = LEADS_HEADERS.map((h) => r[h] ?? "");
      if (vals.some((v) => v)) {
        await holysheetPost(LEADS_SHEET, [vals]);
        appended++;
        if (rowId) rowIdToIndex.set(rowId, sheetData.length + appended + 1);
        if (delayMs) await sleep(delayMs);
      }
    }

    if (incremental) setLastLeadsSyncAt(new Date().toISOString());

    return NextResponse.json({
      success: true,
      appended,
      updated,
      updateFailed,
      skipped: incremental ? skipped : undefined,
      total: rows.length,
      from: lastSync ?? undefined,
    });
  } catch (e) {
    console.error("[POST /api/sync/leads]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
