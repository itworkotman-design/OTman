import type { Metadata } from "next";
import { getOrderByActionToken } from "@/lib/orders/publicOrderAccess";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { CALL_TO_CANCEL, OTMAN_PHONE, OTMAN_PHONE_HREF } from "@/lib/content/companyContact";

// The page behind the "Kanseller bestilling" button older customer emails
// still carry. Cancelling is by phone only now, so it no longer cancels
// anything — it shows the order and the number to call.

export const metadata: Metadata = {
  title: "Kanseller bestilling | Otman AS",
  robots: { index: false, follow: false },
};

const TEXT = {
  no: {
    heading: "Kanseller bestilling",
    notFound: "Fant ikke bestillingen. Sjekk lenken, eller ta kontakt med oss.",
    alreadyCancelled: "Denne bestillingen er allerede kansellert.",
    order: "Bestilling",
    call: "Ring oss",
  },
  en: {
    heading: "Cancel order",
    notFound: "We couldn't find that order. Check the link, or contact us.",
    alreadyCancelled: "This order has already been cancelled.",
    order: "Order",
    call: "Call us",
  },
} as const;

export default async function OrderCancelPage({
  params,
}: {
  params: Promise<{ locale: "en" | "no"; token: string }>;
}) {
  const { locale, token } = await params;
  const t = TEXT[locale];
  const order = await getOrderByActionToken(token);

  if (!order) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold">{t.heading}</h1>
        <p className="mt-4 text-textColorThird">{t.notFound}</p>
      </div>
    );
  }

  const status = normalizeOrderStatus(order.status);
  const closed = status === "cancelled" || status === "refunded";

  return (
    <div className="py-16">
      <h1 className="text-xl font-semibold">{t.heading}</h1>
      <div className="mt-6 max-w-md rounded-lg border border-gray-200 p-6">
        {order.orderNumber || order.displayId ? (
          <p className="text-sm text-textColorThird">
            {t.order} #{order.orderNumber || order.displayId}
          </p>
        ) : null}

        {closed ? (
          <p className="mt-4 text-sm font-medium text-textColorThird">{t.alreadyCancelled}</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-textColorThird">{CALL_TO_CANCEL[locale]}</p>
            <a
              href={OTMAN_PHONE_HREF}
              className="mt-4 inline-flex h-11 items-center rounded-xl bg-logoblue px-5 text-sm font-semibold text-white"
            >
              {t.call}: {OTMAN_PHONE}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
