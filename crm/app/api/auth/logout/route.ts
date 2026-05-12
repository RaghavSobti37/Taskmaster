import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("crm_user", "", { maxAge: 0, path: "/" });
  return res;
}
