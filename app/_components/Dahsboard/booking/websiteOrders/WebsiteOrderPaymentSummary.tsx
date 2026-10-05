"use client";

import type { OrderPaymentComparison } from "@/lib/orders/paidOrderSnapshot";
import { describeDetailChange, describeLineChange, formatKr } from "@/lib/orders/orderChangeText";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";

type Props = {
  comparison: OrderPaymentComparison;
  locale: BookingUiLocale;
  // "now" in the modal, "after this change" in the editor's preview.
  totalLabel?: string;
};

// Paid so far vs. the order now (compareOrderWithPayments), spelled out: the
// amounts, the one thing to act on (collect / refund / nothing), and every
// line and stop that changed since the customer paid.
export default function WebsiteOrderPaymentSummary({ comparison, locale, totalLabel }: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const changeLocale = locale === "nb" ? "no" : "en";
  const c = comparison;
  const changes = [
    ...c.lineChanges.map((change) => ({ text: describeLineChange(change, changeLocale), delta: change.delta })),
    ...c.detailChanges.map((change) => ({ text: describeDetailChange(change, changeLocale), delta: 0 })),
  ];

  const outcome =
    c.outcome === "unpaid"
      ? {
          className: "bg-black/5 text-black/75",
          text: t(`Not paid yet — the customer pays ${formatKr(c.currentTotalIncVatNok)}`, `Ikke betalt ennå — kunden betaler ${formatKr(c.currentTotalIncVatNok)}`),
        }
      : c.outcome === "due"
        ? {
            className: "bg-amber-100 text-amber-900",
            text: t(`Customer must pay ${formatKr(c.differenceIncVatNok)} more`, `Kunden må betale ${formatKr(c.differenceIncVatNok)} til`),
          }
        : c.outcome === "refund"
          ? {
              className: "bg-red-100 text-red-800",
              text: t(
                `Customer overpaid ${formatKr(-c.differenceIncVatNok)} — refund manually in Stripe`,
                `Kunden har betalt ${formatKr(-c.differenceIncVatNok)} for mye — refunder manuelt i Stripe`,
              ),
            }
          : { className: "bg-green-100 text-green-800", text: t("Fully paid — nothing to collect", "Fullt betalt — ingenting å kreve inn") };

  return (
    <div className="flex flex-col gap-3 text-sm">
      {c.outcome !== "unpaid" && (
        <dl className="flex flex-col gap-1.5 text-black/70">
          <div className="flex justify-between gap-3">
            <dt>
              {t("Paid so far", "Betalt så langt")}
              {c.paidAt && <span className="text-black/45"> ({new Date(c.paidAt).toLocaleDateString("nb-NO")})</span>}
            </dt>
            <dd className="font-medium tabular-nums">{formatKr(c.totalPaidIncVatNok)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>{totalLabel ?? t("Order total now (incl. VAT)", "Ordretotal nå (inkl. MVA)")}</dt>
            <dd className="font-medium tabular-nums">{formatKr(c.currentTotalIncVatNok)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-black/10 pt-1.5 font-semibold text-black/85">
            <dt>{t("Difference", "Differanse")}</dt>
            <dd className="tabular-nums">{formatKr(c.differenceIncVatNok, { signed: true })}</dd>
          </div>
        </dl>
      )}

      <p className={`rounded-xl px-4 py-3 text-base font-semibold ${outcome.className}`}>{outcome.text}</p>

      {c.outcome !== "unpaid" && !c.hasPaidSnapshot && (
        <p className="text-xs text-black/50">
          {t(
            "Paid before itemized payment records existed — only the totals can be compared.",
            "Betalt før varelinjer ble lagret ved betaling — kun totalene kan sammenlignes.",
          )}
        </p>
      )}

      {changes.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
            {t("Changed since payment", "Endret siden betaling")}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {changes.map((change) => (
              <li
                key={change.text}
                className={`rounded-lg px-3 py-1.5 ${
                  change.delta > 0 ? "bg-amber-50 text-amber-900" : change.delta < 0 ? "bg-green-50 text-green-900" : "bg-black/5 text-black/75"
                }`}
              >
                {change.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
