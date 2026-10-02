"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import OrderModal from "@/app/_components/Dahsboard/booking/OrderModal";
import WebsiteOrderModal, {
  type WebsiteOrderView,
} from "@/app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderModal";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";

type Props = {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  canDelete?: boolean;
  onDeleted?: () => void;
  locale?: BookingUiLocale;
};

type Resolved =
  | { orderId: string; mode: "website"; order: WebsiteOrderView }
  | { orderId: string; mode: "standard" };

// Drop-in replacement for OrderModal (same props): homepage white-goods
// website orders open in the read-only WebsiteOrderModal, every other order
// in the regular OrderModal, unchanged. Decided by asking
// /api/orders/[orderId]/website-details — any non-ok answer (not a
// white-goods order, no access, error) means the regular modal.
export default function DashboardOrderModal(props: Props) {
  const { orderId, open, onClose, canDelete, onDeleted, locale = "en" } = props;
  const requestedId = open && orderId ? orderId : null;
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const current = resolved && resolved.orderId === requestedId ? resolved : null;

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
        setResolved(
          res.ok && data?.ok && data.order
            ? { orderId: id, mode: "website", order: data.order as WebsiteOrderView }
            : { orderId: id, mode: "standard" },
        );
      } catch {
        if (!cancelled) setResolved({ orderId: id, mode: "standard" });
      }
    }

    void resolve(requestedId);
    return () => {
      cancelled = true;
    };
  }, [requestedId]);

  // Scroll lock + Escape while this component shows its own UI (loading or
  // the website view) — OrderModal handles both itself.
  const showsOwnUi = !!requestedId && (!current || current.mode === "website");
  useEffect(() => {
    if (!showsOwnUi) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showsOwnUi, onClose]);

  if (!requestedId) return null;

  if (current?.mode === "standard") {
    return <OrderModal {...props} />;
  }

  if (current?.mode === "website") {
    return (
      <WebsiteOrderModal
        order={current.order}
        onClose={onClose}
        onOpenStandardEditor={() => setResolved({ orderId: current.orderId, mode: "standard" })}
        canDelete={canDelete}
        onDeleted={onDeleted}
        locale={locale}
      />
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm">
      <div className="rounded-2xl bg-white px-6 py-4 text-textColorThird shadow-2xl">
        {bookingText(locale, "Loading order...")}
      </div>
    </div>,
    document.body,
  );
}
