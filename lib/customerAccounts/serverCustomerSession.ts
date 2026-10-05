import { cookies } from "next/headers";
import { CUSTOMER_SESSION_COOKIE, getCustomerSessionFromToken } from "./customerSession";

// The "My order" session in a server component (pages), from its cookie.
export async function getServerCustomerSession() {
  const store = await cookies();
  return getCustomerSessionFromToken(store.get(CUSTOMER_SESSION_COOKIE)?.value);
}

// Where to go after logging in: only somewhere inside "My order", so the
// login page can't be used to send people elsewhere.
export function safeMyOrderPath(locale: string, next: string | null | undefined): string {
  const base = `/${locale}/min-bestilling`;
  return typeof next === "string" && (next === base || next.startsWith(`${base}/`)) && !next.includes("//") ? next : base;
}
