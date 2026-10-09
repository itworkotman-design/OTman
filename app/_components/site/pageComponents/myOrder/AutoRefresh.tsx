"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-reads the server-rendered page now and then, and when the tab comes back
// into view, so a status staff (or GSM) set shows up without a reload.
export default function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, intervalMs]);

  return null;
}
