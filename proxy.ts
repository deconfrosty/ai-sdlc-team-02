import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session-token";

export async function proxy(request: NextRequest) {
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute =
    pathname === "/" ||
    pathname === "/calendar" ||
    pathname.startsWith("/calendar/");

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/calendar/:path*", "/login"],
};
