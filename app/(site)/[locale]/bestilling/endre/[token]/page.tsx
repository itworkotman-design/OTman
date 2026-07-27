import type { Metadata } from "next";
import { getOrderByActionToken } from "@/lib/orders/publicOrderAccess";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import OrderRequestChangeClient from "@/app/_components/site/pageComponents/OrderRequestChangeClient";

export const metadata: Metadata = {
  title: "Be om endring | Otman AS",
  robots: { index: false, follow: false },
};

const TEXT = {
  no: {
    heading: "Be om endring av bestilling",
    notFound: "Fant ikke bestillingen. Sjekk lenken, eller ta kontakt med oss.",
    notEligible: "Denne bestillingen kan ikke endres akkurat nå. Ta kontakt med oss om du tror dette er feil.",
    order: "Bestilling",
  },
  en: {
    heading: "Request a change to your order",
    notFound: "We couldn't find that order. Check the link, or contact us.",
    notEligible: "This order can't be changed right now. Contact us if you think this is a mistake.",
    order: "Order",
  },
} as const;

export default async function OrderRequestChangePage({
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

  const normalizedStatus = normalizeOrderStatus(order.status);
  const eligible = ["rejected", "approved", "failed"].includes(normalizedStatus);

  return (
    <div className="py-16">
      <h1 className="text-xl font-semibold">{t.heading}</h1>
      <div className="mt-6 max-w-md rounded-lg border border-gray-200 p-6">
        {order.displayId ? (
          <p className="text-sm text-textColorThird">
            {t.order} #{order.displayId}
          </p>
        ) : null}

        {!eligible ? (
          <p className="mt-4 text-sm text-textColorThird">{t.notEligible}</p>
        ) : (
          <OrderRequestChangeClient token={token} locale={locale} />
        )}
      </div>
    </div>
  );
}
