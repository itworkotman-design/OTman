import type { Metadata } from "next";
import { getOrderByActionToken, isOrderPayable } from "@/lib/orders/publicOrderAccess";
import { getOrderChargeAmountIncVatNok } from "@/lib/orders/orderTotals";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import OrderPaymentClient from "@/app/_components/site/pageComponents/OrderPaymentClient";

export const metadata: Metadata = {
  title: "Betaling | Otman AS",
  robots: { index: false, follow: false },
};

const TEXT = {
  no: {
    heading: "Betaling for din bestilling",
    notFound: "Fant ikke bestillingen. Sjekk lenken, eller ta kontakt med oss.",
    alreadyConfirmed: "Denne bestillingen er allerede betalt. Takk!",
    notPayable: "Denne bestillingen kan ikke betales akkurat nå. Ta kontakt med oss om du tror dette er feil.",
    order: "Bestilling",
    delivery: "Leveringsdato",
    products: "Produkter",
    total: "Totalbeløp (inkl. MVA)",
  },
  en: {
    heading: "Payment for your order",
    notFound: "We couldn't find that order. Check the link, or contact us.",
    alreadyConfirmed: "This order has already been paid. Thank you!",
    notPayable: "This order can't be paid right now. Contact us if you think this is a mistake.",
    order: "Order",
    delivery: "Delivery date",
    products: "Products",
    total: "Total amount (incl. VAT)",
  },
} as const;

export default async function OrderPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: "en" | "no"; token: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const { locale, token } = await params;
  const { result } = await searchParams;
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
  const payable = isOrderPayable(order.status);
  const amountIncVat = getOrderChargeAmountIncVatNok(order);

  return (
    <div className="py-16">
      <h1 className="text-xl font-semibold">{t.heading}</h1>

      <div className="mt-6 max-w-md rounded-lg border border-gray-200 p-6">
        <dl className="space-y-2 text-sm">
          {order.displayId ? (
            <div className="flex justify-between">
              <dt className="text-textColorThird">{t.order}</dt>
              <dd className="font-medium">#{order.displayId}</dd>
            </div>
          ) : null}
          {order.deliveryDate ? (
            <div className="flex justify-between">
              <dt className="text-textColorThird">{t.delivery}</dt>
              <dd className="font-medium">{order.deliveryDate}</dd>
            </div>
          ) : null}
          {order.productsSummary ? (
            <div className="flex justify-between gap-4">
              <dt className="text-textColorThird">{t.products}</dt>
              <dd className="text-right font-medium">{order.productsSummary}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-gray-200 pt-2">
            <dt className="text-textColorThird">{t.total}</dt>
            <dd className="font-semibold">NOK {amountIncVat.toLocaleString(locale === "no" ? "nb-NO" : "en-US")}</dd>
          </div>
        </dl>

        {normalizedStatus === "confirmed" ? (
          <p className="mt-6 text-sm font-medium text-green-700">{t.alreadyConfirmed}</p>
        ) : !payable ? (
          <p className="mt-6 text-sm text-textColorThird">{t.notPayable}</p>
        ) : (
          <OrderPaymentClient token={token} locale={locale} payable={payable} resultParam={result ?? null} />
        )}
      </div>
    </div>
  );
}
