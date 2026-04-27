import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["en", "no"];
const defaultLocale = "no";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/client-login" || pathname.startsWith("/client-login/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/booking") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/accept-invite") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/select-company") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (hasLocale) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname}`;

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next).*)"],
};
