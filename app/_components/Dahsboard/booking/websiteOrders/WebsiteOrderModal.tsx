"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import WebsiteOrderPanel, { type WebsiteOrderView } from "./WebsiteOrderPanel";

export type { WebsiteOrderView } from "./WebsiteOrderPanel";

type Props = {
  order: WebsiteOrderView;
  onClose: () => void;
  // After a status/partner save or GSM send — reload the order (and list).
  onChanged: () => void;
  canDelete?: boolean;
  onDeleted?: () => void;
  locale?: BookingUiLocale;
};

// The modal frame around WebsiteOrderPanel (title and close). Opened by
// DashboardOrderModal; admin row clicks open the Alert Center instead, which
// shows the same panel in its "Edit order" tab.
export default function WebsiteOrderModal({ order, onClose, onChanged, canDelete = false, onDeleted, locale = "en" }: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const [unsaved, setUnsaved] = useState(false);

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center px-3 py-6 lg:px-6 lg:py-10">
        <div
          className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 rounded-t-2xl bg-white px-6 py-4">
            <h2 className="min-w-0 text-2xl font-semibold text-logoblue">
              {t("Editing website order", "Redigerer nettsidebestilling")} - {order.displayId}
            </h2>
            <button
              type="button"
              onClick={() => {
                if (unsaved && !window.confirm(t("Discard your unsaved changes to the order?", "Forkaste ulagrede endringer i bestillingen?"))) {
                  return;
                }
                onClose();
              }}
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-logoblue text-white"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <WebsiteOrderPanel
              order={order}
              onChanged={onChanged}
              canDelete={canDelete}
              onDeleted={onDeleted}
              onDone={onClose}
              onUnsavedChange={setUnsaved}
              locale={locale}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
