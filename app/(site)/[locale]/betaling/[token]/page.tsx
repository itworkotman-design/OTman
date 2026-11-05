import type { Metadata } from "next";
import { getOrderByActionToken, isOrderPayable, isTopUpPayable } from "@/lib/orders/publicOrderAccess";
import { isAwaitingBookingPayment } from "@/lib/orders/bookingPayment";
import { getOrderChargeAmountIncVatNok, getOrderRemainingBalanceIncVatNok } from "@/lib/orders/orderTotals";
import { sumOrderPayments } from "@/lib/orders/orderPayments";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import OrderPaymentClient from "@/app/_components/site/pageComponents/OrderPaymentClient";
import { buildOrderStateSnapshot, compareOrderWithPayments } from "@/lib/orders/paidOrderSnapshot";
import { currentOrderLines, describeDetailChange, paymentPageRows, type PaymentPageRow } from "@/lib/orders/orderChangeText";

export const metadata: Metadata = {
  title: "Betaling | Otman AS",
  robots: { index: false, follow: false },
};

const TEXT = {
  no: {
    heading: "Betaling for din bestilling",
    eyebrow: "Betaling",
    yourOrder: "Din bestilling",
    otherChanges: "Andre endringer",
    secure: "Sikker kortbetaling via Stripe",
    marks: { added: "Ny", changed: "Endret", removed: "Fjernet" },
    notFound: "Fant ikke bestillingen. Sjekk lenken, eller ta kontakt med oss.",
    alreadyConfirmed: "Denne bestillingen er allerede betalt. Takk!",
    bookingPaid: "Takk! Betalingen er mottatt, og bekreftelsen er sendt til e-posten din. Vi går gjennom bestillingen og bekrefter den snart.",
    confirmingPayment: "Takk! Vi registrerer betalingen din. Oppdater siden om et øyeblikk.",
    cancelled: "Denne bestillingen er kansellert. Ble ikke betalingen fullført, kan du bestille på nytt.",
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
    eyebrow: "Payment",
    yourOrder: "Your order",
    otherChanges: "Other changes",
    secure: "Secure card payment via Stripe",
    marks: { added: "New", changed: "Changed", removed: "Removed" },
    notFound: "We couldn't find that order. Check the link, or contact us.",
    alreadyConfirmed: "This order has already been paid. Thank you!",
    bookingPaid: "Thank you! Your payment was received, and the confirmation has been sent to your email. We will review the order and confirm it shortly.",
    confirmingPayment: "Thank you! We are registering your payment. Refresh the page in a moment.",
    cancelled: "This order has been cancelled. If the payment was not completed, you can book again.",
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
      <div className="mx-auto max-w-xl py-12 sm:px-4 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t.heading}</h1>
        <div className="mt-6">
          <Notice tone="neutral">{t.notFound}</Notice>
        </div>
      </div>
    );
  }

  const normalizedStatus = normalizeOrderStatus(order.status);
  // Paid at booking (lib/orders/bookingPayment.ts): Stripe returns here.
  const awaitingBookingPayment = isAwaitingBookingPayment(order);
  const bookingPaid = normalizedStatus === "processing" && (order.paymentStatus === "paid" || order.paymentStatus === "refund_pending");
  const payable = isOrderPayable(order.status) || awaitingBookingPayment;
  const amountIncVat = getOrderChargeAmountIncVatNok(order);
  const totalPaidCents = sumOrderPayments(order.payments);
  const remainingBalanceIncVat = getOrderRemainingBalanceIncVatNok(order, totalPaidCents);
  const isTopUp = isTopUpPayable(order.status, remainingBalanceIncVat, totalPaidCents);
  const fmt = (n: number) => n.toLocaleString(locale === "no" ? "nb-NO" : "en-US");
  // On a top-up: exactly what changed since the last payment.
  const comparison = isTopUp
    ? compareOrderWithPayments({
        payments: order.payments,
        current: buildOrderStateSnapshot({ ...order, extraPickupAddress: order.extraPickupAddress ?? [] }),
      })
    : null;
  // What the customer pays for, line by line — as in the dashboard's
  // calculator — on a top-up marked with what changed since they paid.
  const itemRows = paymentPageRows(currentOrderLines(order), comparison?.lineChanges ?? [], locale);
  // Stops, floors and dates that changed (the lines carry their own marks).
  const otherChanges = comparison ? comparison.detailChanges.map((change) => describeDetailChange(change, locale)) : [];
  const reference = order.orderNumber || order.displayId;

  // What the customer can do here: pay (with a notice on a top-up), or read
  // why not.
  const state: { notice?: { tone: NoticeTone; text: string }; pay: boolean } =
    isTopUp && result === "success"
      ? // Stripe can send the customer back before its webhook lands —
        // without this they'd be offered the same top-up again.
        { notice: { tone: "success", text: t.confirmingPayment }, pay: false }
      : isTopUp
        ? { notice: { tone: "warning", text: t.balanceDueNotice }, pay: true }
        : normalizedStatus === "confirmed"
          ? { notice: { tone: "success", text: t.alreadyConfirmed }, pay: false }
          : bookingPaid
            ? { notice: { tone: "success", text: t.bookingPaid }, pay: false }
            : normalizedStatus === "cancelled"
              ? { notice: { tone: "neutral", text: t.cancelled }, pay: false }
              : awaitingBookingPayment && result === "success"
                ? // Stripe can send the customer back before its webhook lands.
                  { notice: { tone: "success", text: t.confirmingPayment }, pay: false }
                : !payable
                  ? { notice: { tone: "neutral", text: t.notPayable }, pay: false }
                  : { pay: true };

  return (
    <div className="mx-auto max-w-xl py-12 sm:px-4 sm:py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-logoblue">{t.eyebrow}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{t.heading}</h1>
      {reference || order.deliveryDate ? (
        <p className="mt-3 text-textColorThird">
          {reference ? `${t.order} #${reference}` : null}
          {reference && order.deliveryDate ? " · " : null}
          {order.deliveryDate ? `${t.delivery} ${order.deliveryDate}` : null}
        </p>
      ) : null}

      <div className="mt-8 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {state.notice && (
          <div className="px-4 pt-4 sm:px-6 sm:pt-6">
            <Notice tone={state.notice.tone}>{state.notice.text}</Notice>
          </div>
        )}

        {itemRows.length > 0 || order.productsSummary ? (
          <section className="px-4 pt-4 sm:px-6 sm:pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t.yourOrder}</h2>
            {itemRows.length > 0 ? (
              <ul className="mt-3 divide-y divide-gray-100">
                {itemRows.map((row, index) => (
                  <ItemRow key={`${row.name}-${index}`} row={row} markLabels={t.marks} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm font-medium text-gray-900">{order.productsSummary}</p>
            )}
          </section>
        ) : null}

        {otherChanges.length > 0 && (
          <section className="px-4 pt-5 sm:px-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t.otherChanges}</h2>
            <ul className="mt-2 space-y-1 text-sm text-textColorThird">
              {otherChanges.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        )}

        <dl className="mx-4 my-4 space-y-2 rounded-xl bg-logoblue/5 px-4 py-4 text-sm sm:mx-6 sm:my-6 sm:px-5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className={isTopUp ? "text-textColorThird" : "font-semibold text-gray-900"}>{isTopUp ? t.newTotal : t.total}</dt>
            <dd className={`whitespace-nowrap ${isTopUp ? "font-medium text-gray-900" : "text-2xl font-bold text-logoblue"}`}>NOK {fmt(amountIncVat)}</dd>
          </div>
          {isTopUp && (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-textColorThird">{t.amountPaid}</dt>
                <dd className="whitespace-nowrap font-medium text-gray-900">− NOK {fmt(totalPaidCents / 100)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-logoblue/15 pt-3">
                <dt className="font-semibold text-gray-900">{t.payNow}</dt>
                <dd className="whitespace-nowrap text-2xl font-bold text-logoblue">NOK {fmt(remainingBalanceIncVat)}</dd>
              </div>
            </>
          )}
        </dl>

        {state.pay && (
          <div className="px-4 pb-4 sm:px-6 sm:pb-6">
            <OrderPaymentClient token={token} locale={locale} payable resultParam={result ?? null} />
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path
                  fillRule="evenodd"
                  d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
                  clipRule="evenodd"
                />
              </svg>
              {t.secure}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

type NoticeTone = "success" | "warning" | "neutral";

const NOTICE_STYLES: Record<NoticeTone, string> = {
  success: "bg-green-50 text-green-800",
  warning: "bg-amber-50 text-amber-900",
  neutral: "bg-gray-50 text-textColorThird",
};

function Notice({ tone, children }: { tone: NoticeTone; children: React.ReactNode }) {
  return <p className={`rounded-xl px-4 py-3 text-sm font-medium ${NOTICE_STYLES[tone]}`}>{children}</p>;
}

type Mark = NonNullable<PaymentPageRow["mark"]>;

const MARK_STYLES: Record<Mark, string> = {
  added: "bg-logoblue/10 text-logoblue",
  changed: "bg-amber-100 text-amber-900",
  removed: "bg-gray-100 text-gray-500",
};

function ItemRow({ row, markLabels }: { row: PaymentPageRow; markLabels: Record<Mark, string> }) {
  const removed = row.mark === "removed";
  return (
    <li className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="flex flex-wrap items-center gap-2">
        <span className={removed ? "text-gray-400 line-through" : "text-gray-700"}>{row.name}</span>
        {row.mark && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${MARK_STYLES[row.mark]}`}>{markLabels[row.mark]}</span>}
      </span>
      <span className={`shrink-0 font-medium tabular-nums ${removed ? "text-gray-400 line-through" : "text-gray-900"}`}>{row.amount}</span>
    </li>
  );
}
