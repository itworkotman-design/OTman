"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import { getVatBreakdown } from "@/lib/booking/pricing/vatDisplayTotal";
import type { OrderPaymentComparison } from "@/lib/orders/paidOrderSnapshot";
import {
  partnerMinusForDiscount,
  type WebsiteOrderCalculatorLine,
  type WebsiteOrderCalculatorView,
} from "@/lib/orders/websiteOrderCalculator";
import WebsiteOrderPaymentSummary from "./WebsiteOrderPaymentSummary";

type Adjustments = { rabatt: string; leggTil: string; subcontractorMinus: string; subcontractorPlus: string };

type Props = {
  orderId: string;
  calculator: WebsiteOrderCalculatorView;
  adjustments: Adjustments;
  // What the stored lines don't explain (checkWebsiteOrderTotals), shown in red.
  missingFromLines: number;
  // The saved total — the calculator re-prices, so a difference is flagged.
  storedTotal: number;
  locale: BookingUiLocale;
  // After a save — reload the order.
  onChanged: () => void;
};

const PREVIEW_DELAY_MS = 700;

function formatKr(n: number) {
  return `${Math.round(n).toLocaleString("nb-NO")} kr`;
}

function formatQty(qty: number) {
  return String(Math.round(qty * 2) / 2);
}

// The calculator in WebsiteOrderModal, like the booking app's
// (CalculatorDisplayNew + SubcontractorCalculatorDisplay): the customer's
// lines, discount, extra and total, then the partner's lines, minus, plus and
// total, each with its inputs underneath. As in the booking app, changing the
// discount sets the partner minus to the same share of the partner's pay
// (partnerMinusForDiscount), which can then be overridden.
//
// Changes are priced live (a `dryRun` of PUT /api/orders/[orderId]/website-items
// with just these four `handling` fields) and compared with what was paid;
// "Save prices" stores them. The partner side and the inputs are only there
// for admins (the server leaves `partner` out for viewers).
export default function WebsiteOrderCalculator({
  orderId,
  calculator,
  adjustments,
  missingFromLines,
  storedTotal,
  locale,
  onChanged,
}: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const isAdmin = calculator.partner !== null;
  const [adj, setAdj] = useState<Adjustments>(adjustments);
  const [view, setView] = useState<WebsiteOrderCalculatorView>(calculator);
  const [preview, setPreview] = useState<OrderPaymentComparison | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const previewSeq = useRef(0);

  const changed = JSON.stringify(adj) !== JSON.stringify(adjustments);

  async function put(dryRun: boolean) {
    const res = await fetch(`/api/orders/${orderId}/website-items`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ handling: adj, dryRun }),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok && !!data?.ok, data };
  }

  const previewKey = changed ? JSON.stringify(adj) : "";
  useEffect(() => {
    const seq = ++previewSeq.current;
    if (!previewKey) {
      setView(calculator);
      setPreview(null);
      setPreviewing(false);
      setPreviewFailed(false);
      return;
    }
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const { ok, data } = await put(true);
        if (seq !== previewSeq.current) return;
        setPreviewFailed(!ok);
        if (ok) {
          setView(data.calculator);
          setPreview(data.comparison);
        }
      } catch {
        if (seq === previewSeq.current) setPreviewFailed(true);
      } finally {
        if (seq === previewSeq.current) setPreviewing(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  function setDiscount(rabatt: string) {
    // The booking app's rule: the partner minus follows the discount.
    setAdj((current) => ({
      ...current,
      rabatt,
      subcontractorMinus: partnerMinusForDiscount({
        rabatt,
        subtotal: view.customer.subtotal,
        partnerBase: view.partner?.base ?? 0,
      }),
    }));
  }

  async function handleSave() {
    setMessage(null);
    try {
      setSaving(true);
      const { ok } = await put(false);
      if (!ok) {
        setMessage({
          tone: "error",
          text: t("Couldn't save — amounts must be in kroner.", "Kunne ikke lagre — beløp må være i kroner."),
        });
        return;
      }
      onChanged();
    } catch {
      setMessage({ tone: "error", text: t("Couldn't save the prices.", "Kunne ikke lagre prisene.") });
    } finally {
      setSaving(false);
    }
  }

  // The order re-priced now (today's catalog) differs from what's saved.
  const priceOutdated = Math.round(calculator.customer.total) !== Math.round(storedTotal);

  // Re-saves the order unchanged, which re-prices it at today's prices — like
  // the booking app's "Use new price". What was paid is compared as usual.
  async function handleUseNewPrice() {
    if (
      !confirm(
        t(
          `Change the order total from ${formatKr(storedTotal)} to ${formatKr(calculator.customer.total)}? If the customer has paid, the difference shows as due or to refund.`,
          `Endre ordretotalen fra ${formatKr(storedTotal)} til ${formatKr(calculator.customer.total)}? Har kunden betalt, vises differansen som utestående eller til refusjon.`,
        ),
      )
    ) {
      return;
    }
    await handleSave();
  }

  const vat = getVatBreakdown(view.customer.total);
  const fieldClass = "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-black/85";
  const labelClass = "text-sm font-medium text-black/60";

  const lineRows = (lines: WebsiteOrderCalculatorLine[], side: "customer" | "partner") =>
    lines.map((line, index) => (
      <Fragment key={index}>
        <span className="flex items-center gap-2 text-black/60">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${side === "partner" ? "bg-amber-600" : "bg-logoblue"}`}
          />
          <span>
            {line.qty > 1 && <span className="mr-1 opacity-70">x{formatQty(line.qty)}</span>}
            {line.code && <span className={`mr-1 ${side === "partner" ? "text-amber-700" : "text-logoblue"}`}>({line.code})</span>}
            {line.label}
          </span>
        </span>
        <span className="whitespace-nowrap text-right font-medium tabular-nums text-black/70">
          {formatKr(side === "partner" ? (line.partner ?? 0) : line.customer)}
        </span>
      </Fragment>
    ));

  const productList = (side: "customer" | "partner") =>
    view.products.length === 0 ? (
      <p className="mt-3 text-sm text-black/50">{t("No products.", "Ingen varer.")}</p>
    ) : (
      <div className="mt-4 flex flex-col gap-4">
        {view.products.map((product, index) => (
          <div key={index}>
            <p className="font-semibold text-black/85">
              {product.isOrderExtras ? t("Order extras", "Tillegg til ordren") : product.name}
            </p>
            {product.lines.length > 0 && (
              <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 pl-1 text-sm">
                {lineRows(product.lines, side)}
              </div>
            )}
          </div>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold text-logoblue">{t("Calculator", "Kalkulator")}</h3>
          {previewing && <span className="text-xs text-black/50">{t("Calculating…", "Beregner…")}</span>}
        </div>
        <p className="text-xs text-black/45">{t("Prices incl. VAT", "Priser inkl. mva")}</p>

        {productList("customer")}

        {!changed && priceOutdated && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            <p>
              {t(
                `Priced now this order comes to ${formatKr(calculator.customer.total)}, but it is saved at ${formatKr(storedTotal)} (prices have changed since).`,
                `Priset nå blir ordren ${formatKr(calculator.customer.total)}, men den er lagret med ${formatKr(storedTotal)} (prisene er endret siden).`,
              )}
            </p>
            {isAdmin && (
              <button
                type="button"
                onClick={handleUseNewPrice}
                disabled={saving}
                className="mt-2 rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {saving ? t("Saving…", "Lagrer…") : t("Use new price", "Bruk ny pris")}
              </button>
            )}
            {message && !changed && <p className="mt-2 text-sm font-medium text-red-700">{message.text}</p>}
          </div>
        )}

        {missingFromLines !== 0 && !changed && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            <span>{t("Not covered by the stored lines", "Ikke dekket av de lagrede linjene")}</span>
            <span className="whitespace-nowrap font-semibold tabular-nums">
              {missingFromLines > 0 ? "+" : ""}
              {formatKr(missingFromLines)}
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 border-t border-black/10 pt-4 text-sm text-black/70">
          {view.customer.discount !== 0 && (
            <div className="flex justify-between">
              <span>{t("Discount", "Rabatt")}</span>
              <span className="tabular-nums">-{formatKr(view.customer.discount)}</span>
            </div>
          )}
          {view.customer.extra !== 0 && (
            <div className="flex justify-between">
              <span>{t("Extra", "Tillegg")}</span>
              <span className="tabular-nums">
                {view.customer.extra > 0 ? "+" : ""}
                {formatKr(view.customer.extra)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{t("Subtotal (ex. VAT)", "Delsum (eks. mva)")}</span>
            <span className="tabular-nums">{formatKr(vat.exVat)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("VAT (25%)", "MVA (25%)")}</span>
            <span className="tabular-nums">{formatKr(vat.vat)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-logoblue/10 px-4 py-5">
            <span className="text-base font-semibold text-logoblue">{t("Total incl. VAT", "Totalt inkl. MVA")}</span>
            <span className="whitespace-nowrap text-3xl font-bold tabular-nums text-logoblue">{formatKr(vat.incVat)}</span>
          </div>
        </div>

        {isAdmin && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className={labelClass}>{t("Discount (kr)", "Rabatt (kr)")}</span>
              <input
                inputMode="decimal"
                value={adj.rabatt}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder={t("e.g. 500", "f.eks. 500")}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>{t("Extra (kr)", "Tillegg (kr)")}</span>
              <input
                inputMode="decimal"
                value={adj.leggTil}
                onChange={(e) => setAdj((current) => ({ ...current, leggTil: e.target.value }))}
                placeholder={t("e.g. 300", "f.eks. 300")}
                className={fieldClass}
              />
            </label>
          </div>
        )}
      </div>

      {view.partner && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-amber-800">{t("Partner view", "Partnervisning")}</h3>

          {productList("partner")}

          <div className="mt-4 flex flex-col gap-2 border-t border-amber-200 pt-4 text-sm text-black/70">
            {view.partner.minus !== 0 && (
              <div className="flex justify-between">
                <span>{t("Minus", "Minus")}</span>
                <span className="tabular-nums">-{formatKr(view.partner.minus)}</span>
              </div>
            )}
            {view.partner.plus !== 0 && (
              <div className="flex justify-between">
                <span>{t("Plus", "Pluss")}</span>
                <span className="tabular-nums">+{formatKr(view.partner.plus)}</span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between gap-4">
              <span className="text-base font-bold text-amber-900">{t("Total", "Totalt")}</span>
              <span className="whitespace-nowrap text-2xl font-bold tabular-nums text-amber-900">
                {formatKr(view.partner.total)}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className={labelClass}>{t("Partner minus (kr)", "Partner minus (kr)")}</span>
              <input
                inputMode="decimal"
                value={adj.subcontractorMinus}
                onChange={(e) => setAdj((current) => ({ ...current, subcontractorMinus: e.target.value }))}
                placeholder={t("e.g. 200", "f.eks. 200")}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>{t("Partner plus (kr)", "Partner pluss (kr)")}</span>
              <input
                inputMode="decimal"
                value={adj.subcontractorPlus}
                onChange={(e) => setAdj((current) => ({ ...current, subcontractorPlus: e.target.value }))}
                placeholder={t("e.g. 200", "f.eks. 200")}
                className={fieldClass}
              />
            </label>
          </div>
        </div>
      )}

      {isAdmin && changed && (
        <div className="rounded-2xl border border-logoblue/20 bg-logoblue/5 p-4">
          <p className="mb-2 text-sm font-semibold text-logoblue">{t("Price after this change", "Pris etter endringen")}</p>
          {preview && !previewFailed ? (
            <WebsiteOrderPaymentSummary comparison={preview} locale={locale} totalLabel={t("New total (incl. VAT)", "Ny total (inkl. MVA)")} />
          ) : (
            !previewing &&
            previewFailed && (
              <p className="text-xs text-red-700">
                {t("Amounts must be in kroner (e.g. 500 or 99,50).", "Beløp må være i kroner (f.eks. 500 eller 99,50).")}
              </p>
            )
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || previewFailed}
              className="inline-flex h-10 items-center justify-center rounded-full bg-logoblue px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? t("Saving…", "Lagrer…") : t("Save prices", "Lagre priser")}
            </button>
            <button
              type="button"
              onClick={() => setAdj(adjustments)}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-full border border-logoblue px-5 text-sm font-semibold text-logoblue disabled:opacity-50"
            >
              {t("Undo", "Angre")}
            </button>
          </div>
          {message && (
            <p className={`mt-2 text-sm font-medium ${message.tone === "ok" ? "text-green-700" : "text-red-600"}`}>{message.text}</p>
          )}
        </div>
      )}
    </div>
  );
}
