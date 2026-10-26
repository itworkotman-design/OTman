"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import OrderEditPanel from "@/app/_components/Dahsboard/booking/OrderEditPanel";
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

// Standalone order editor. Order rows open the Alert Center's "Edit order" tab
// instead; this is for orders not in the loaded table yet (e.g. a fresh copy).
export default function OrderModal({
  orderId,
  open,
  onClose,
  onSaved,
  canDelete = false,
  onDeleted,
  locale = "en",
}: Props) {
  // Remembers which order the loaded number belongs to, so a stale one never
  // shows while the next order is loading.
  const [loaded, setLoaded] = useState<{ orderId: string; displayId?: number } | null>(null);
  const displayId = loaded && loaded.orderId === orderId ? loaded.displayId : undefined;
  const archiveOrderId = typeof displayId === "number" && displayId > 0 ? String(displayId) : null;

  useEffect(() => {
    if (!open) return;

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
  }, [open, onClose]);

  // Only ever open after a click, so this is client-side; the document check
  // just keeps server rendering safe before portaling into document.body.
  if (!open || typeof document === "undefined") return null;

  // createPortal renders directly into document.body, escaping any parent
  // that has transform/filter/isolation which would break fixed positioning
  // and clip the bg-black/50 backdrop.
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center px-3 py-6 lg:px-6 lg:py-10">
        <div className="w-full max-w-[1700] max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Sticky header */}
          <div className="shrink-0 flex items-center justify-between rounded-t-2xl border-b bg-white px-6 py-4">
            <h2 className="text-2xl font-semibold text-logoblue">
              {archiveOrderId
                ? `${bookingText(locale, "Editing order")} - ${archiveOrderId}`
                : orderId
                  ? bookingText(locale, "Editing order")
                  : bookingText(locale, "Order")}
            </h2>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-logoblue text-white cursor-pointer">
              ×
            </button>
          </div>

          {/* Scrollable body — only this div scrolls */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
            {orderId ? (
              <OrderEditPanel
                orderId={orderId}
                locale={locale}
                canDelete={canDelete}
                onSaved={onSaved}
                onDeleted={onDeleted}
                onDone={onClose}
                onLoaded={(order) => setLoaded({ orderId, displayId: order.displayId })}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
