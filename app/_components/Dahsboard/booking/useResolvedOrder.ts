"use client";

import { useEffect, useState } from "react";
import type { WebsiteOrderView } from "@/app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderPanel";
import { orderModalMode } from "./orderModalMode";

export type ResolvedOrder =
  | { orderId: string; mode: "website"; order: WebsiteOrderView }
  | { orderId: string; mode: "standard" }
  | { orderId: string; mode: "error" };

// Asks /api/orders/[orderId]/website-details whether an order is a homepage
// website order (and loads it if so) — see orderModalMode. `current` is null
// while loading; `reload` re-fetches in place (the current view stays up
// meanwhile), `retry` starts over from the loading state. Shared by
// DashboardOrderModal and the Alert Center's website editor
// (WebsiteOrderEditPanel).
export function useResolvedOrder(requestedId: string | null) {
  const [resolved, setResolved] = useState<ResolvedOrder | null>(null);
  const current = resolved && resolved.orderId === requestedId ? resolved : null;
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!requestedId) return;
    let cancelled = false;

    async function resolve(id: string) {
      try {
        const res = await fetch(`/api/orders/${id}/website-details`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        const mode = orderModalMode(res.status, data);
        setResolved(
          mode === "website"
            ? { orderId: id, mode, order: data.order as WebsiteOrderView }
            : { orderId: id, mode },
        );
      } catch {
        if (!cancelled) setResolved({ orderId: id, mode: "error" });
      }
    }

    void resolve(requestedId);
    return () => {
      cancelled = true;
    };
    // reloadCount only re-triggers the fetch.
  }, [requestedId, reloadCount]);

  return {
    current,
    reload: () => setReloadCount((count) => count + 1),
    retry: () => {
      setResolved(null);
      setReloadCount((count) => count + 1);
    },
  };
}
