/**
 * Demo auth: sets cookie for dev. Call with ?userId=&email=&role=admin|sales
 */
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "crm_user";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.CRM_DEMO_AUTH)
    return NextResponse.json({ error: "Demo auth disabled" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || "demo-admin";
  const email = searchParams.get("email") || "admin@demo.local";
  const role = searchParams.get("role") || "admin";
  const name = searchParams.get("name") || "Demo User";

  const payload = JSON.stringify({ id: userId, email, role, name });
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, Buffer.from(payload).toString("base64"), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
