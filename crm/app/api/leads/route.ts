import { NextRequest, NextResponse } from "next/server";
import { getLeads } from "@/lib/csv-store";
import { getCurrentUser } from "@/lib/auth";
import { getUserById, normalizeAssignedRepToId } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const repFilter = searchParams.get("rep");
    const search = searchParams.get("search")?.toLowerCase();

    let rows = getLeads() as Array<
      Record<string, string> & { row_index: number }
    >;

    // Filter by role: super_admin sees all; team_leader sees team reps; sales_rep sees own
    if (user.role === "sales_rep") {
      rows = rows.filter(
        (r) => normalizeAssignedRepToId(r.assigned_rep_id || "") === user.id
      );
    } else if (user.role === "team_leader") {
      const u = getUserById(user.id);
      const teamIds = new Set(u?.team ?? []);
      rows = rows.filter((r) =>
        teamIds.has(normalizeAssignedRepToId(r.assigned_rep_id || ""))
      );
    } else if (repFilter) {
      rows = rows.filter(
        (r) => normalizeAssignedRepToId(r.assigned_rep_id || "") === repFilter
      );
    }

    if (search) {
      const s = search;
      rows = rows.filter(
        (r) =>
          (String(r.name || "")).toLowerCase().includes(s) ||
          (String(r.email || "")).toLowerCase().includes(s) ||
          (String(r.phone || "")).includes(s)
      );
    }

    return NextResponse.json({ data: rows, count: rows.length });
  } catch (e) {
    console.error("[GET /api/leads]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch leads" },
      { status: 500 }
    );
  }
}
