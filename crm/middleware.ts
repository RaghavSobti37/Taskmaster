import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BASE_PATH = "/crm";
const PUBLIC = ["/login", "/api/auth", "/api/webhook"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const path = pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || "/" : pathname;
  if (PUBLIC.some((p) => path === p || path.startsWith(p + "/"))) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.next();

  const hasUser = req.cookies.get("crm_user");
  if (!hasUser && (path === "/" || path.startsWith("/dashboard") || path.startsWith("/leads") || path.startsWith("/followups") || path.startsWith("/import"))) {
    return NextResponse.redirect(new URL(`${BASE_PATH}/login`, req.url));
  }
  if (hasUser && path === "/") {
    return NextResponse.redirect(new URL(`${BASE_PATH}/dashboard`, req.url));
  }
  return NextResponse.next();
}
