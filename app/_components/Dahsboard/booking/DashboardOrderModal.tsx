"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import OrderModal from "@/app/_components/Dahsboard/booking/OrderModal";
import WebsiteOrderModal from "@/app/_components/Dahsboard/booking/websiteOrders/WebsiteOrderModal";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import { useResolvedOrder } from "./useResolvedOrder";

type Props = {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  canDelete?: boolean;
  onDeleted?: () => void;
  locale?: BookingUiLocale;
};

// Drop-in replacement for OrderModal (same props): homepage white-goods
// website orders open in WebsiteOrderModal, every other order in the regular
// OrderModal, unchanged. Decided by asking /api/orders/[orderId]/website-details
// (see orderModalMode) — a failed lookup shows an error with a retry, never
// the regular modal: a website order must not be edited there.
export default function DashboardOrderModal(props: Props) {
  const { orderId, open, onClose, onSaved, canDelete, onDeleted, locale = "en" } = props;
  const requestedId = open && orderId ? orderId : null;
  const { current, reload, retry } = useResolvedOrder(requestedId);

  // Scroll lock + Escape while this component shows its own UI (loading or
  // the website view) — OrderModal handles both itself.
  const showsOwnUi = !!requestedId && (!current || current.mode !== "standard");
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
        onChanged={() => {
          reload();
          onSaved?.();
        }}
        canDelete={canDelete}
        onDeleted={onDeleted}
        locale={locale}
      />
    );
  }

  if (current?.mode === "error") {
    const t = (en: string, no: string) => (locale === "nb" ? no : en);
    return createPortal(
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-6 py-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm font-medium text-red-600">{t("Couldn't load the order.", "Kunne ikke laste bestillingen.")}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={retry}
              className="customButtonEnabled h-10 px-5"
            >
              {t("Try again", "Prøv igjen")}
            </button>
            <button type="button" onClick={onClose} className="customButtonDefault h-10 px-5">
              {t("Close", "Lukk")}
            </button>
          </div>
        </div>
      </div>,
      document.body,
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
