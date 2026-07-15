import type { ReactNode } from "react";
import { headers } from "next/headers";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Reading headers() forces dynamic rendering, so the nonce baked into Next's
  // hydration scripts always matches the per-request nonce proxy.ts puts in the
  // CSP header. Without this, Next statically prerenders these pages (none of
  // them use a dynamic API) and ships a stale nonce, so the CSP silently blocks
  // hydration and the login form stops responding to clicks.
  await headers();

  return (
    <div className="">
          {children}
    </div>
  );
}
