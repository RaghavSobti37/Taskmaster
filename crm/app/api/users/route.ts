import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAssignableUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = getAssignableUsers().map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
  }));
  return NextResponse.json({ data: users });
}
