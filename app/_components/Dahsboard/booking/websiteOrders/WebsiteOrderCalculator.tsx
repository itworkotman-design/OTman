"use client";

import type { PriceChangeRow } from "@/lib/booking/pricing/priceChanges";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import type { OrderPaymentComparison } from "@/lib/orders/paidOrderSnapshot";
import {
  nulledLinesFromView,
  partnerMinusForDiscount,
  toggleNulledLine,
  type WebsiteOrderCalculatorLine,
  type WebsiteOrderCalculatorView,
  type WebsiteOrderNulledLines,
  type WebsiteOrderPricingDraft,
} from "@/lib/orders/websiteOrderCalculator";
import { parseNokAdjustment } from "@/lib/orders/orderTotals";
import WebsiteOrderPaymentSummary from "./WebsiteOrderPaymentSummary";

type Adjustments = {
  rabatt: string;
  leggTil: string;
  subcontractorMinus: string;
  subcontractorPlus: string;
};

type Props = {
  orderId: string;
  calculator: WebsiteOrderCalculatorView;
  adjustments: Adjustments;
  // What the stored lines don't explain (checkWebsiteOrderTotals), shown in red.
  missingFromLines: number;
  // The saved total.
  storedTotal: number;
  // The customer total at today's catalog prices: when it differs from the
  // saved one, "Use new price" is offered. Missing: the calculator's own total.
  currentPricesTotal?: number | null;
  // Each line priced differently today (named under "Use new price"), and the
  // products whose saved prices lack their delivery type or an option.
  priceChanges?: PriceChangeRow[];
  savedPricesIncomplete?: string[];
  locale: BookingUiLocale;
  // The unsaved changes (null when there are none); the modal's Save stores them.
  onDraftChange: (draft: WebsiteOrderPricingDraft | null) => void;
  // Where to show "Price after this change" (above the modal's Save); inline when absent.
  priceChangeTarget?: HTMLElement | null;
  // Where its dry-run preview is priced — a move previews through
  // /api/orders/[orderId]/moving-details (same body and answer) instead.
  previewEndpoint?: string;
  // The "Edit order" tab prices products, stops and these choices together
  // and saves them in one go: then this calculator doesn't fetch or save — it
  // shows the parent's latest pricing and only reports its draft. `calculator`
  // stays the order as first priced (what "changed" compares against).
  // "Use new price" is the parent's too there: useNewPrice says whether it's
  // chosen, onUseNewPrice chooses it (the note hides once it is).
  externalPricing?: {
    view: WebsiteOrderCalculatorView | null;
    previewing: boolean;
    useNewPrice?: boolean;
    onUseNewPrice?: () => void;
  };
};

const PREVIEW_DELAY_MS = 700;

type Side = "customer" | "partner";
type CalculatorProduct = WebsiteOrderCalculatorView["products"][number];
const NO_NULLED: WebsiteOrderNulledLines = {
  cards: {},
  orderExtras: { customer: [], subcontractor: [] },
};

// Order-independent form of the choices, to tell whether they changed.
function canonicalNulled(nulled: WebsiteOrderNulledLines) {
  const sorted = (keys: string[]) => [...keys].sort();
  const cards = Object.entries(nulled.cards)
    .map(([cardId, sides]) => [cardId, sorted(sides.customer), sorted(sides.subcontractor)] as const)
    .filter(([, customer, subcontractor]) => customer.length > 0 || subcontractor.length > 0)
    .sort(([a], [b]) => Number(a) - Number(b));
  return JSON.stringify([cards, sorted(nulled.orderExtras.customer), sorted(nulled.orderExtras.subcontractor)]);
}

function hasNulled(nulled: WebsiteOrderNulledLines) {
  return canonicalNulled(nulled) !== canonicalNulled(NO_NULLED);
}

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
// with just these four `handling` fields) and compared with what was paid.
// Nothing here ever writes the order: every change, "Use new price" included,
// goes up as a draft and only the modal's Save stores it. The partner side and
// the inputs are only there for admins (the server leaves `partner` out for viewers).
export default function WebsiteOrderCalculator({
  orderId,
  calculator,
  adjustments,
  missingFromLines,
  storedTotal,
  currentPricesTotal = null,
  priceChanges = [],
  savedPricesIncomplete = [],
  locale,
  onDraftChange,
  priceChangeTarget = null,
  previewEndpoint,
  externalPricing,
}: Props) {
  const external = !!externalPricing;
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const isAdmin = calculator.partner !== null;
  // Every amount here is ex. VAT, as stored (website prices are ex. VAT, like
  // the booking app's); only the total incl. VAT adds 25%, per line.
  const shownAdjustments = adjustments;
  const [adj, setAdj] = useState<Adjustments>(shownAdjustments);
  const storedAdj = adj;
  // The booking app's "Set to 0" checkboxes: lines nulled per side.
  const initialNulled = useMemo(() => nulledLinesFromView(calculator), [calculator]);
  const [nulled, setNulled] = useState<WebsiteOrderNulledLines>(initialNulled);
  const [ownView, setView] = useState<WebsiteOrderCalculatorView>(calculator);
  const [preview, setPreview] = useState<OrderPaymentComparison | null>(null);
  const [ownPreviewing, setPreviewing] = useState(false);
  const view = externalPricing ? (externalPricing.view ?? calculator) : ownView;
  const previewing = externalPricing ? externalPricing.previewing : ownPreviewing;
  // false, or why the preview failed (the server's reason, or true when unknown).
  const [previewFailed, setPreviewFailed] = useState<false | true | string>(false);
  // "Use new price" pressed: re-price at today's prices on the next Save. A
  // save with the calculator's draft re-prices the order, so the draft alone
  // (even with unchanged amounts) carries it.
  const [useNewPrice, setUseNewPrice] = useState(false);
  const previewSeq = useRef(0);
  // Set by a checkbox click: skip the typing delay for that preview.
  const immediatePreview = useRef(false);

  const changed =
    useNewPrice || JSON.stringify(adj) !== JSON.stringify(shownAdjustments) || canonicalNulled(nulled) !== canonicalNulled(initialNulled);
  // Same rules as the booking app: lines can only be set to 0 while there is
  // no discount / partner minus, and those inputs hide while lines are set to 0.
  const hasDiscountValue = parseNokAdjustment(adj.rabatt) !== 0 || parseNokAdjustment(adj.subcontractorMinus) !== 0;
  const anyNulled = hasNulled(nulled);

  useEffect(() => {
    onDraftChange(changed ? { adjustments: storedAdj, nulledLines: nulled, ...(useNewPrice ? { useCurrentPrices: true } : {}) } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changed, storedAdj, nulled, useNewPrice]);

  // Always a dry run — this component never saves.
  async function pricePreview() {
    const res = await fetch(previewEndpoint ?? `/api/orders/${orderId}/website-items`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ handling: storedAdj, nulledLines: nulled, dryRun: true, ...(useNewPrice ? { useCurrentPrices: true } : {}) }),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok && !!data?.ok, data };
  }

  const previewKey = changed ? JSON.stringify(adj) + canonicalNulled(nulled) + (useNewPrice ? "|new-price" : "") : "";
  useEffect(() => {
    if (external) return;
    const seq = ++previewSeq.current;
    if (!previewKey) {
      setView(calculator);
      setPreview(null);
      setPreviewing(false);
      setPreviewFailed(false);
      return;
    }
    const delay = immediatePreview.current ? 0 : PREVIEW_DELAY_MS;
    immediatePreview.current = false;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const { ok, data } = await pricePreview();
        if (seq !== previewSeq.current) return;
        setPreviewFailed(ok ? false : (data?.reason ?? true));
        if (ok) {
          setView(data.calculator);
          setPreview(data.comparison);
        }
      } catch {
        if (seq === previewSeq.current) setPreviewFailed(true);
      } finally {
        if (seq === previewSeq.current) setPreviewing(false);
      }
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  const withPriceChangeTarget = (node: ReactNode) => (priceChangeTarget ? createPortal(node, priceChangeTarget) : node);

  function setDiscount(rabatt: string) {
    // A discount replaces lines set to 0 (booking app: setting one clears them).
    if (parseNokAdjustment(rabatt) !== 0) setNulled(NO_NULLED);
    // The booking app's rule: the partner minus follows the discount.
    setAdj((current) => ({
      ...current,
      rabatt,
      // rabatt and the subtotal it's a share of are both ex. VAT.
      subcontractorMinus: partnerMinusForDiscount({
        rabatt,
        subtotal: view.customer.subtotal,
        partnerBase: view.partner?.base ?? 0,
      }),
    }));
  }

  // Today's catalog prices the order differently from what's saved.
  const currentTotal = currentPricesTotal ?? calculator.customer.total;
  // Row by row (priceChanges, from website-details): only a row whose price
  // moved since the order was saved offers "Use new price" — not a difference
  // between the stored total and a fresh calculation.
  const priceOutdated = priceChanges.length > 0 && !externalPricing?.useNewPrice;

  // The VAT is what the per-line incl.-VAT total adds (websiteVat.ts).
  const vat = { exVat: view.customer.total, incVat: view.customer.totalIncVat, vat: Math.round((view.customer.totalIncVat - view.customer.total) * 100) / 100 };
  const fieldClass = "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-black/85";
  const labelClass = "text-sm font-medium text-black/60";

  function nulledKeys(product: CalculatorProduct, side: Side): string[] {
    const sides = product.isOrderExtras ? nulled.orderExtras : product.cardId !== null ? nulled.cards[product.cardId] : undefined;
    return (side === "partner" ? sides?.subcontractor : sides?.customer) ?? [];
  }

  function toggleNulled(product: CalculatorProduct, side: Side, lineKey: string, on: boolean) {
    const target = product.isOrderExtras ? ({ orderExtras: true } as const) : product.cardId !== null ? { cardId: product.cardId } : null;
    if (!target) return;
    // A click is priced straight away, like the booking app's calculator.
    immediatePreview.current = true;
    setNulled((current) => toggleNulledLine(current, target, side, lineKey, on));
  }

  const lineRows = (product: CalculatorProduct, lines: WebsiteOrderCalculatorLine[], side: Side) =>
    lines.map((line, index) => {
      const canNull = isAdmin && !hasDiscountValue && !!line.lineKey && (product.cardId !== null || product.isOrderExtras);
      const isNulled = !!line.lineKey && nulledKeys(product, side).includes(line.lineKey);
      return (
        <Fragment key={index}>
          <span className={`flex min-w-0 items-center gap-2 text-black/60 ${isNulled ? "line-through opacity-60" : ""}`}>
            {canNull ? (
              <input
                type="checkbox"
                title={t("Set to 0", "Sett til 0")}
                aria-label={t("Set to 0", "Sett til 0")}
                checked={isNulled}
                onChange={(e) => toggleNulled(product, side, line.lineKey!, e.target.checked)}
                className="shrink-0"
              />
            ) : (
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${side === "partner" ? "bg-amber-600" : "bg-logoblue"}`}
              />
            )}
            {/* Option codes (WASHING_MACHINE_NONAPPR_WET) have no natural break
                point — let them wrap instead of widening the column. */}
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {line.qty > 1 && <span className="mr-1 opacity-70">x{formatQty(line.qty)}</span>}
              {line.code && <span className={`mr-1 ${side === "partner" ? "text-amber-700" : "text-logoblue"}`}>({line.code})</span>}
              {line.label}
            </span>
          </span>
          <span
            className={`whitespace-nowrap text-right font-medium tabular-nums text-black/70 ${isNulled ? "line-through opacity-60" : ""}`}
          >
            {formatKr(side === "partner" ? (line.partner ?? 0) : line.customer)}
          </span>
        </Fragment>
      );
    });

  const productList = (side: "customer" | "partner") =>
    view.products.length === 0 ? (
      <p className="mt-3 text-sm text-black/50">{t("No products.", "Ingen varer.")}</p>
    ) : (
      <div className="mt-4 flex flex-col gap-4">
        {view.products.map((product, index) => (
          <div key={index}>
            <p className="font-semibold text-black/85">{product.isOrderExtras ? t("Order extras", "Tillegg til ordren") : product.name}</p>
            {product.lines.length > 0 && (
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 pl-1 text-sm">
                {lineRows(product, product.lines, side)}
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
        <p className="text-xs text-black/45">{t("Prices ex. VAT", "Priser eks. mva")}</p>

        {productList("customer")}

        {!changed && priceOutdated && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            <p>
              {t(
                `Priced now this order comes to ${formatKr(currentTotal)} ex. VAT, but it is saved at ${formatKr(storedTotal)} (prices have changed since).`,
                `Priset nå blir ordren ${formatKr(currentTotal)} eks. mva, men den er lagret med ${formatKr(storedTotal)} (prisene er endret siden).`,
              )}
            </p>
            {priceChanges.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 font-normal">
                {priceChanges.map((change) => (
                  <li key={`${change.productName ?? ""}|${change.label}`} className="flex justify-between gap-3">
                    <span>{change.productName ? `${change.productName}: ${change.label}` : change.label}</span>
                    <span className="whitespace-nowrap text-right tabular-nums">
                      {change.saved !== change.now && `${formatKr(change.saved)} → ${formatKr(change.now)}`}
                      {change.savedPartner !== null && change.nowPartner !== null && change.savedPartner !== change.nowPartner && (
                        <span className="block text-xs font-normal text-red-800/80">
                          {t("Partner", "Partner")}: {formatKr(change.savedPartner)} → {formatKr(change.nowPartner)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {isAdmin && (
              // Only marks the new price as a change — "Price after this change"
              // shows it, and it's stored when Save is pressed (or dropped by Reset).
              <button
                type="button"
                onClick={() => (externalPricing ? externalPricing.onUseNewPrice?.() : setUseNewPrice(true))}
                className="mt-2 rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800"
              >
                {t("Use new price", "Bruk ny pris")}
              </button>
            )}
          </div>
        )}

        {savedPricesIncomplete.length > 0 && !changed && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {t(
              `The saved prices are missing a delivery or service price for: ${savedPricesIncomplete.join(", ")}. The order may be stored without that charge — check the lines, or use the new price.`,
              `De lagrede prisene mangler en leverings- eller tjenestepris for: ${savedPricesIncomplete.join(", ")}. Ordren kan være lagret uten den kostnaden — sjekk linjene, eller bruk ny pris.`,
            )}
          </p>
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
          {/* Same order as the booking app's calculator: the ex-VAT total leads. */}
          <div className="mt-1 flex items-center justify-between gap-4 rounded-xl bg-logoblue/10 px-4 py-4">
            <span className="text-base font-semibold text-logoblue">{t("Total", "Totalt")}</span>
            <span className="whitespace-nowrap text-3xl font-bold tabular-nums text-logoblue">{formatKr(vat.exVat)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("VAT (25%)", "MVA (25%)")}</span>
            <span className="tabular-nums">{formatKr(vat.vat)}</span>
          </div>
          <div className="flex justify-between font-semibold text-black/85">
            <span>{t("Total incl. VAT", "Totalt inkl. MVA")}</span>
            <span className="tabular-nums">{formatKr(vat.incVat)}</span>
          </div>
        </div>

        {isAdmin && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {!anyNulled && (
              <label className="flex flex-col gap-1">
                <span className={labelClass}>{t("Discount ex. VAT (kr)", "Rabatt eks. mva (kr)")}</span>
                <input
                  inputMode="decimal"
                  value={adj.rabatt}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder={t("e.g. 500", "f.eks. 500")}
                  className={fieldClass}
                />
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className={labelClass}>{t("Extra ex. VAT (kr)", "Tillegg eks. mva (kr)")}</span>
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
              <span className="whitespace-nowrap text-2xl font-bold tabular-nums text-amber-900">{formatKr(view.partner.total)}</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {!anyNulled && (
              <label className="flex flex-col gap-1">
                <span className={labelClass}>{t("Partner minus (kr)", "Partner minus (kr)")}</span>
                <input
                  inputMode="decimal"
                  value={adj.subcontractorMinus}
                  onChange={(e) => {
                    const subcontractorMinus = e.target.value;
                    if (parseNokAdjustment(subcontractorMinus) !== 0) setNulled(NO_NULLED);
                    setAdj((current) => ({ ...current, subcontractorMinus }));
                  }}
                  placeholder={t("e.g. 200", "f.eks. 200")}
                  className={fieldClass}
                />
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className={labelClass}>{t("Partner plus (kr)", "Partner pluss (kr)")}</span>
              <input
                inputMode="decimal"
                value={adj.subcontractorPlus}
                onChange={(e) =>
                  setAdj((current) => ({
                    ...current,
                    subcontractorPlus: e.target.value,
                  }))
                }
                placeholder={t("e.g. 200", "f.eks. 200")}
                className={fieldClass}
              />
            </label>
          </div>
        </div>
      )}

      {isAdmin && changed && !external && withPriceChangeTarget(
        <div className="rounded-2xl border border-logoblue/20 bg-logoblue/5 p-4">
          <p className="mb-2 text-sm font-semibold text-logoblue">{t("Price after this change", "Pris etter endringen")}</p>
          {preview && !previewFailed ? (
            <WebsiteOrderPaymentSummary
              comparison={preview}
              locale={locale}
              totalLabel={t("New total (incl. VAT)", "Ny total (inkl. MVA)")}
            />
          ) : (
            !previewing &&
            previewFailed && (
              <p className="text-xs text-red-700">
                {previewFailed === "PRICES_OUTDATED"
                  ? t(
                      "This order was saved with older prices, so its price can't be changed as it is. Press \"Use new price\" first.",
                      "Denne bestillingen ble lagret med eldre priser, så prisen kan ikke endres slik den er. Trykk «Bruk ny pris» først.",
                    )
                  : t("Amounts must be in kroner (e.g. 500 or 99,50).", "Beløp må være i kroner (f.eks. 500 eller 99,50).")}
              </p>
            )
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-black/55">{t("Stored when you press Save.", "Lagres når du trykker Lagre.")}</p>
            <button
              type="button"
              onClick={() => {
                setAdj(shownAdjustments);
                setNulled(initialNulled);
                setUseNewPrice(false);
              }}
              className="inline-flex h-10 items-center justify-center rounded-full border border-logoblue px-5 text-sm font-semibold text-logoblue disabled:opacity-50"
            >
              {t("Reset prices", "Tilbakestill priser")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
