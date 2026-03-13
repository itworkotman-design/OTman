import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["en", "no"];
const defaultLocale = "no";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ignore next internals and files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // if already /en or /no, allow
  const hasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}`)
  );

  if (hasLocale) {
    return NextResponse.next();
  }

  // redirect / -> /no
  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname}`;

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next).*)"],
};