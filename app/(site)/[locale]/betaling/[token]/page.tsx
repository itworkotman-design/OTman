import type { Metadata } from "next";
import { getOrderByActionToken, isOrderPayable, isTopUpPayable } from "@/lib/orders/publicOrderAccess";
import { getOrderChargeAmountIncVatNok, getOrderRemainingBalanceIncVatNok } from "@/lib/orders/orderTotals";
import { sumOrderPayments } from "@/lib/orders/orderPayments";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import OrderPaymentClient from "@/app/_components/site/pageComponents/OrderPaymentClient";
import { buildOrderStateSnapshot, compareOrderWithPayments } from "@/lib/orders/paidOrderSnapshot";
import { describeDetailChange, describeLineChange } from "@/lib/orders/orderChangeText";

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
    balanceDueNotice: "Bestillingen din er oppdatert. Betal restbeløpet under for å bekrefte.",
    changesHeading: "Dette er endret siden du betalte",
    newTotal: "Ny totalpris (inkl. MVA)",
    payNow: "Å betale nå",
    order: "Bestilling",
    delivery: "Leveringsdato",
    products: "Produkter",
    total: "Totalbeløp (inkl. MVA)",
    amountPaid: "Betalt så langt",
    remainingBalance: "Gjenstående beløp",
  },
  en: {
    heading: "Payment for your order",
    notFound: "We couldn't find that order. Check the link, or contact us.",
    alreadyConfirmed: "This order has already been paid. Thank you!",
    notPayable: "This order can't be paid right now. Contact us if you think this is a mistake.",
    balanceDueNotice: "Your order was updated. Pay the remaining balance below to confirm.",
    changesHeading: "What changed since you paid",
    newTotal: "New total (incl. VAT)",
    payNow: "To pay now",
    order: "Order",
    delivery: "Delivery date",
    products: "Products",
    total: "Total amount (incl. VAT)",
    amountPaid: "Paid so far",
    remainingBalance: "Remaining balance",
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
  const totalPaidCents = sumOrderPayments(order.payments);
  const remainingBalanceIncVat = getOrderRemainingBalanceIncVatNok(order, totalPaidCents);
  const isTopUp = isTopUpPayable(order.status, remainingBalanceIncVat);
  const fmt = (n: number) => n.toLocaleString(locale === "no" ? "nb-NO" : "en-US");
  // On a top-up: exactly what changed since the last payment.
  const comparison = isTopUp
    ? compareOrderWithPayments({
        payments: order.payments,
        current: buildOrderStateSnapshot({ ...order, extraPickupAddress: order.extraPickupAddress ?? [] }),
      })
    : null;
  const changeLines = comparison
    ? [
        ...comparison.lineChanges.map((change) => describeLineChange(change, locale)),
        ...comparison.detailChanges.map((change) => describeDetailChange(change, locale)),
      ]
    : [];

  return (
    <div className="py-16">
      <h1 className="text-xl font-semibold">{t.heading}</h1>

      <div className="mt-6 max-w-md rounded-lg border border-gray-200 p-6">
        <dl className="space-y-2 text-sm">
          {order.orderNumber || order.displayId ? (
            <div className="flex justify-between">
              <dt className="text-textColorThird">{t.order}</dt>
              <dd className="font-medium">#{order.orderNumber || order.displayId}</dd>
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
            <dt className="text-textColorThird">{isTopUp ? t.newTotal : t.total}</dt>
            <dd className="font-semibold">NOK {fmt(amountIncVat)}</dd>
          </div>
          {isTopUp && (
            <>
              <div className="flex justify-between">
                <dt className="text-textColorThird">{t.amountPaid}</dt>
                <dd className="font-medium">NOK {fmt(totalPaidCents / 100)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <dt className="font-semibold">{t.payNow}</dt>
                <dd className="text-lg font-bold">NOK {fmt(remainingBalanceIncVat)}</dd>
              </div>
            </>
          )}
        </dl>

        {changeLines.length > 0 && (
          <div className="mt-6 text-sm">
            <p className="font-semibold">{t.changesHeading}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-textColorThird">
              {changeLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {isTopUp ? (
          <>
            <p className="mt-6 text-sm text-textColorThird">{t.balanceDueNotice}</p>
            <OrderPaymentClient token={token} locale={locale} payable resultParam={result ?? null} />
          </>
        ) : normalizedStatus === "confirmed" ? (
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
