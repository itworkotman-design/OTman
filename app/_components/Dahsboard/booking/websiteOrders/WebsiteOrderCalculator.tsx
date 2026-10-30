"use client";

import type { PriceChangeRow } from "@/lib/booking/pricing/priceChanges";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import {
  addAdjustmentLine,
  adjustmentLinesFromLegacy,
  removeAdjustmentLine,
  sumAdjustmentLines,
  unlinkAdjustmentLines,
  updateAdjustmentLine,
  type AdjustmentLine,
  type AdjustmentLineKind,
  type AdjustmentLinePatch,
} from "@/lib/booking/pricing/adjustmentLines";
import {
  AddAdjustmentLineButtons,
  AdjustmentLineRows,
  type AdjustmentLineHandlers,
  type AdjustmentRowText,
} from "@/app/_components/Dahsboard/booking/create/CalculatorDisplay";
import type { OrderPaymentComparison } from "@/lib/orders/paidOrderSnapshot";
import {
  calculatorPreviewBody,
  formatLineQty,
  nulledLinesFromView,
  toggleNulledLine,
  type WebsiteOrderCalculatorLine,
  type WebsiteOrderCalculatorView,
  type WebsiteOrderNulledLines,
  type WebsiteOrderPricingDraft,
} from "@/lib/orders/websiteOrderCalculator";
import { parseNokAdjustment } from "@/lib/orders/orderTotals";
import type { PricedHandlingFields } from "@/lib/orders/websiteOrderHandling";
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
  // The stored adjustment lines (website-details); without them the four
  // amounts are shown as plain lines.
  adjustmentLines?: AdjustmentLine[];
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
  // The "Handle order" panel's unsaved express/deviation (pricedHandlingFields):
  // priced into the preview so their lines show here before Save — the
  // panel's Save stores them, never this calculator's draft.
  pricedHandling?: PricedHandlingFields | null;
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

// The calculator in WebsiteOrderModal, like the booking app's
// (CalculatorDisplayNew + SubcontractorCalculatorDisplay): the customer's
// lines, adjustment lines (discounts/extras) and total, then the partner's
// lines, minus/plus lines and total. The adjustment lines are the booking
// app's own (AdjustmentLineRows, lib/booking/pricing/adjustmentLines): several
// per kind, each with a description, in NOK or %, and a discount brings a
// linked partner minus with the same share of the partner's pay.
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
  adjustmentLines,
  missingFromLines,
  storedTotal,
  currentPricesTotal = null,
  priceChanges = [],
  savedPricesIncomplete = [],
  locale,
  onDraftChange,
  priceChangeTarget = null,
  previewEndpoint,
  pricedHandling = null,
  externalPricing,
}: Props) {
  const external = !!externalPricing;
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const isAdmin = calculator.partner !== null;
  // Every amount here is ex. VAT, as stored (website prices are ex. VAT, like
  // the booking app's); only the total incl. VAT adds 25%, per line.
  // As the booking app loads a saved order: lines linked during setup no longer follow.
  const initialLines = useMemo(
    () => unlinkAdjustmentLines(adjustmentLines ?? adjustmentLinesFromLegacy(adjustments)),
    [adjustmentLines, adjustments],
  );
  const [lines, setLines] = useState<AdjustmentLine[]>(initialLines);
  // The four amounts the order is priced with: the lines' per-kind sums.
  const adj: Adjustments = useMemo(() => sumAdjustmentLines(lines), [lines]);
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
    useNewPrice || JSON.stringify(lines) !== JSON.stringify(initialLines) || canonicalNulled(nulled) !== canonicalNulled(initialNulled);
  // Same rules as the booking app: lines can only be set to 0 while there is
  // no discount / partner minus, and those inputs hide while lines are set to 0.
  const hasDiscountValue = parseNokAdjustment(adj.rabatt) !== 0 || parseNokAdjustment(adj.subcontractorMinus) !== 0;
  const anyNulled = hasNulled(nulled);

  useEffect(() => {
    onDraftChange(
      changed
        ? { adjustments: storedAdj, adjustmentLines: lines, nulledLines: nulled, ...(useNewPrice ? { useCurrentPrices: true } : {}) }
        : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changed, storedAdj, lines, nulled, useNewPrice]);

  // Always a dry run — this component never saves.
  async function pricePreview() {
    const res = await fetch(previewEndpoint ?? `/api/orders/${orderId}/website-items`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(calculatorPreviewBody(storedAdj, nulled, useNewPrice, pricedHandling)),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok && !!data?.ok, data };
  }

  const previewKey =
    changed || pricedHandling
      ? JSON.stringify(adj) + canonicalNulled(nulled) + (useNewPrice ? "|new-price" : "") + JSON.stringify(pricedHandling)
      : "";
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

  // What a % line is a share of, and what a linked partner minus follows.
  const lineTotals = { subtotalExVat: view.customer.subtotal, subcontractorBase: view.partner?.base ?? 0 };
  const lineTotalsRef = useRef(lineTotals);
  lineTotalsRef.current = lineTotals;

  // A discount or partner minus replaces lines set to 0 (booking app:
  // setting one clears them).
  // The latest lines, so consecutive edits each build on the previous one.
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const applyLines = useCallback((update: (current: AdjustmentLine[]) => AdjustmentLine[]) => {
    const next = update(linesRef.current);
    linesRef.current = next;
    setLines(next);
    const sums = sumAdjustmentLines(next);
    if (parseNokAdjustment(sums.rabatt) !== 0 || parseNokAdjustment(sums.subcontractorMinus) !== 0) setNulled(NO_NULLED);
  }, []);
  const lineHandlers: AdjustmentLineHandlers = useMemo(
    () => ({
      onAdd: (kind: AdjustmentLineKind) => applyLines((current) => addAdjustmentLine(current, kind)),
      onUpdate: (id: string, patch: AdjustmentLinePatch) =>
        applyLines((current) => updateAdjustmentLine(current, id, patch, lineTotalsRef.current)),
      onRemove: (id: string) => applyLines((current) => removeAdjustmentLine(current, id, lineTotalsRef.current)),
      onApply: (id: string) => applyLines((current) => unlinkAdjustmentLines(current, id)),
    }),
    [applyLines],
  );
  const rowText = (partner: boolean): AdjustmentRowText => {
    const b = (text: string) => bookingText(locale, text);
    return {
      description: b("Description"),
      descriptionPlaceholder: partner ? b("e.g. Waiting time") : b("e.g. Damaged packaging"),
      optional: b("optional"),
      amount: b("Amount (ex VAT)"),
      remove: b("Remove"),
      add: b("Add"),
      apply: b("Apply"),
      edit: b("Edit"),
      cancel: b("Cancel"),
      subtracted: partner ? b("Subtracted from partner total") : b("Subtracted from total"),
      added: partner ? b("Added to partner total") : b("Added to total"),
      percent: b("Percent"),
      switchToPercent: b("Switch to %"),
      switchToNok: b("Switch to NOK"),
    };
  };

  // Today's catalog prices the order differently from what's saved.
  const currentTotal = currentPricesTotal ?? calculator.customer.total;
  // Row by row (priceChanges, from website-details): only a row whose price
  // moved since the order was saved offers "Use new price" — not a difference
  // between the stored total and a fresh calculation.
  const priceOutdated = priceChanges.length > 0 && !externalPricing?.useNewPrice;

  // The VAT is what the per-line incl.-VAT total adds (websiteVat.ts).
  const vat = { exVat: view.customer.total, incVat: view.customer.totalIncVat, vat: Math.round((view.customer.totalIncVat - view.customer.total) * 100) / 100 };

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
              {line.qty > 1 && <span className="mr-1 opacity-70">x{formatLineQty(line.qty)}</span>}
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
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white p-5">
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
          <AdjustmentLineRows
            lines={lines}
            kinds={["discount", "extra"]}
            labels={{ discount: t("Discount", "Rabatt"), extra: t("Extra", "Tillegg") }}
            handlers={isAdmin ? lineHandlers : undefined}
            text={rowText(false)}
          />
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
          <AddAdjustmentLineButtons
            className="mt-5 border-black/10"
            actions={[
              // Lines set to 0 and a discount don't mix (booking app rule).
              ...(anyNulled ? [] : [{ kind: "discount" as const, label: bookingText(locale, "Add discount") }]),
              { kind: "extra" as const, label: bookingText(locale, "Add extra") },
            ]}
            onAdd={lineHandlers.onAdd}
          />
        )}
      </div>

      {view.partner && (
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-amber-800">{t("Partner view", "Partnervisning")}</h3>

          {productList("partner")}

          <div className="mt-4 flex flex-col gap-2 border-t border-amber-200 pt-4 text-sm text-black/70">
            <AdjustmentLineRows
              lines={lines}
              kinds={["subcontractorMinus", "subcontractorPlus"]}
              labels={{ subcontractorMinus: t("Minus", "Minus"), subcontractorPlus: t("Plus", "Pluss") }}
              handlers={lineHandlers}
              text={rowText(true)}
            />
            <div className="mt-1 flex items-center justify-between gap-4">
              <span className="text-base font-bold text-amber-900">{t("Total", "Totalt")}</span>
              <span className="whitespace-nowrap text-2xl font-bold tabular-nums text-amber-900">{formatKr(view.partner.total)}</span>
            </div>
          </div>

          <AddAdjustmentLineButtons
            className="mt-5 border-amber-200"
            actions={[
              ...(anyNulled ? [] : [{ kind: "subcontractorMinus" as const, label: bookingText(locale, "Add partner minus") }]),
              { kind: "subcontractorPlus" as const, label: bookingText(locale, "Add partner plus") },
            ]}
            onAdd={lineHandlers.onAdd}
          />
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
                setLines(initialLines);
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
