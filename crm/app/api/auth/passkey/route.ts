import { NextRequest, NextResponse } from "next/server";
import { getUserByPasskey } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const passkey = body.passkey?.trim();
    if (!passkey) {
      return NextResponse.json({ error: "Passkey required" }, { status: 400 });
    }

    const user = getUserByPasskey(passkey);
    if (!user) {
      return NextResponse.json({ error: "Invalid passkey" }, { status: 401 });
    }

    const payload = JSON.stringify({
      id: user.id,
      email: user.email || `${user.id}@crm.local`,
      name: user.name,
      role: user.role,
    });

    const res = NextResponse.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
    res.cookies.set("crm_user", Buffer.from(payload).toString("base64"), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return res;
  } catch (e) {
    console.error("[POST /api/auth/passkey]", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
