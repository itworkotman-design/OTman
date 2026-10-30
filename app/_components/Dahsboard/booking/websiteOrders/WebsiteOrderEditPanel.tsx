"use client";

import OrderEditPanel from "@/app/_components/Dahsboard/booking/OrderEditPanel";
import { useResolvedOrder } from "@/app/_components/Dahsboard/booking/useResolvedOrder";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import WebsiteOrderPanel from "./WebsiteOrderPanel";

type Props = {
  orderId: string;
  locale?: BookingUiLocale;
  canDelete?: boolean;
  onSaved?: () => void;
  onDeleted?: () => void;
  // After a delete (or a regular-editor save) — the Alert Center closes.
  onDone: () => void;
  onUnsavedChange?: (unsaved: boolean) => void;
};

// The Alert Center's "Edit order" tab for a homepage order: the website
// order view (WebsiteOrderPanel), so staff switch between it and the order's
// Conversation / SMS / history / notifications in one modal. Loads the order
// like DashboardOrderModal; an order that turns out not to be a website order
// gets the regular editor, and a failed load an error with a retry — never
// the regular editor for a website order.
export default function WebsiteOrderEditPanel({ orderId, locale = "en", canDelete = false, onSaved, onDeleted, onDone, onUnsavedChange }: Props) {
  const { current, reload, retry } = useResolvedOrder(orderId);
  const t = (en: string, no: string) => (locale === "nb" ? no : en);

  if (current?.mode === "website") {
    return (
      <WebsiteOrderPanel
        order={current.order}
        onChanged={() => {
          reload();
          onSaved?.();
        }}
        canDelete={canDelete}
        onDeleted={onDeleted}
        onDone={onDone}
        onUnsavedChange={onUnsavedChange}
        locale={locale}
        tabBarClassName=""
        bodyClassName="pt-4"
      />
    );
  }

  if (current?.mode === "standard") {
    return (
      <OrderEditPanel orderId={orderId} locale={locale} canDelete={canDelete} onSaved={onSaved} onDeleted={onDeleted} onDone={onDone} />
    );
  }

  if (current?.mode === "error") {
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="text-sm font-medium text-red-600">{t("Couldn't load the order.", "Kunne ikke laste bestillingen.")}</p>
        <button type="button" onClick={retry} className="customButtonEnabled h-10 px-5">
          {t("Try again", "Prøv igjen")}
        </button>
      </div>
    );
  }

  return <div className="py-6 text-textColorThird">{bookingText(locale, "Loading order...")}</div>;
}
