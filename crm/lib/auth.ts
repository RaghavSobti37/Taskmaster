/**
 * Role-based auth. Reads from crm_user cookie (set by passkey login).
 */
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getUserById, normalizeAssignedRepToId } from "./users";
import type { User } from "@/types";

export async function getCurrentUser(req?: NextRequest): Promise<User | null> {
  void req;
  const cookieStore = await cookies();
  const c = cookieStore.get("crm_user")?.value;
  if (!c) return null;
  try {
    const j = JSON.parse(Buffer.from(c, "base64").toString("utf8"));
    if (!j?.id) return null;
    const u = getUserById(j.id);
    if (!u) return null;
    return {
      id: u.id,
      email: u.email || `${u.id}@crm.local`,
      name: u.name,
      role: u.role,
    };
  } catch {
    return null;
  }
}

export function canAccessLead(user: User, assignedRepId: string): boolean {
  const normalizedAssignedRepId = normalizeAssignedRepToId(assignedRepId || "");
  if (user.role === "super_admin") return true;
  if (user.role === "team_leader") {
    const u = getUserById(user.id);
    return u?.team?.includes(normalizedAssignedRepId) ?? false;
  }
  return user.id === normalizedAssignedRepId;
}
