import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["en", "no"];
const defaultLocale = "no";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore Next internals, files, API, dashboard
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/booking") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/accept-invite") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Allow already-localized routes
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (hasLocale) {
    return NextResponse.next();
  }

  // Redirect public routes to default locale
  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname}`;

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next).*)"],
};