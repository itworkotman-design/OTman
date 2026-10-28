"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import type {
  PriceLookup,
  ProductBreakdown,
} from "@/lib/booking/pricing/types";
import {
  sumAdjustmentLines,
  type AdjustmentLine,
  type AdjustmentLineKind,
  type AdjustmentLinePatch,
} from "@/lib/booking/pricing/adjustmentLines";
import { sanitizeAmountInput, trackNewAdjustmentLines } from "./adjustmentLineEditing";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";

function roundPriceRule(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatNOK(n: number) {
  return `${Math.round(n)} NOK`;
}

function formatSumNOK(n: number) {
  return roundPriceRule(n).toFixed(2);
}

function formatQty(qty: number) {
  const rounded = Math.round(qty * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function parseAmountInput(value: string) {
  const n = Number(value.replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const EMPTY_ADJUSTMENT_LINES: AdjustmentLine[] = [];

export type AdjustmentLineHandlers = {
  onAdd: (kind: AdjustmentLineKind) => void;
  onUpdate: (id: string, patch: AdjustmentLinePatch) => void;
  onRemove: (id: string) => void;
  // Ends initial setup of a line: its linked partner minus stops following it.
  onApply: (id: string) => void;
};

const NEGATIVE_KINDS: AdjustmentLineKind[] = ["discount", "subcontractorMinus"];

function formatAmountInput(amount: number) {
  return amount ? String(amount) : "";
}

// Keeps the typed text (e.g. "12,") while the parent holds the parsed number,
// and picks up external changes such as a linked partner minus recalculating.
function AmountInput({
  id,
  amount,
  onChange,
  onKeyDown,
  autoFocus,
}: {
  id: string;
  amount: number;
  onChange: (amount: number) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(formatAmountInput(amount));
  const [syncedAmount, setSyncedAmount] = useState(amount);
  if (amount !== syncedAmount) {
    setSyncedAmount(amount);
    if (parseAmountInput(text) !== amount) setText(formatAmountInput(amount));
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={text}
      autoFocus={autoFocus}
      onChange={(e) => {
        const sanitized = sanitizeAmountInput(e.target.value);
        setText(sanitized);
        const next = parseAmountInput(sanitized);
        setSyncedAmount(next);
        onChange(next);
      }}
      onKeyDown={onKeyDown}
      className="customInput h-9 w-full pr-16! text-right text-sm font-semibold"
      placeholder="0"
    />
  );
}

type AdjustmentRowText = {
  description: string;
  descriptionPlaceholder: string;
  optional: string;
  amount: string;
  remove: string;
  add: string;
  apply: string;
  edit: string;
  cancel: string;
  subtracted: string;
  added: string;
  percent: string;
  switchToPercent: string;
  switchToNok: string;
};

function formatPercent(percent: number) {
  return `${String(percent).replace(".", ",")} %`;
}

function AppliedAdjustmentRow({
  line,
  label,
  onEdit,
  onRemove,
  text,
}: {
  line: AdjustmentLine;
  label?: string;
  onEdit?: () => void;
  onRemove?: () => void;
  text: AdjustmentRowText;
}) {
  const sign = NEGATIVE_KINDS.includes(line.kind) ? "-" : "+";
  const iconButton = "rounded px-1 text-sm leading-none opacity-40 transition-opacity hover:opacity-100 focus:opacity-100";

  return (
    <div className="priceRow group">
      <h1 className="text-md min-w-0">
        {label}
        {line.description ? <span className="opacity-70"> – {line.description}</span> : null}
        {line.percent !== undefined ? <span className="opacity-70"> ({formatPercent(line.percent)})</span> : null}
      </h1>
      <div className="flex shrink-0 items-center gap-x-1">
        <p className="font-semibold whitespace-nowrap">
          {sign}
          {formatSumNOK(line.amount)} NOK
        </p>
        {onEdit && (
          <button type="button" onClick={onEdit} title={text.edit} aria-label={text.edit} className={iconButton}>
            ✎
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title={text.remove}
            aria-label={text.remove}
            className={`${iconButton} text-red-600 font-bold`}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// Draft line: totals (and a discount's linked partner minus) already preview
// live while typing; Apply only collapses it into an applied row. Cancel
// discards a new line, or restores an edited line's original values.
function DraftAdjustmentRow({
  line,
  label,
  handlers,
  onClose,
  text,
}: {
  line: AdjustmentLine;
  label?: string;
  handlers: AdjustmentLineHandlers;
  onClose: () => void;
  text: AdjustmentRowText;
}) {
  const fieldId = useId();
  const [original] = useState<AdjustmentLinePatch>(() =>
    line.percent !== undefined
      ? { description: line.description, percent: line.percent }
      : { description: line.description, amount: line.amount },
  );
  const isNew = !original.amount && !original.percent;
  const subtracts = NEGATIVE_KINDS.includes(line.kind);
  const isPercent = line.percent !== undefined;
  const canApply = line.amount > 0;

  const apply = () => {
    if (!canApply) return;
    handlers.onApply(line.id);
    onClose();
  };
  const cancel = () => {
    if (isNew) {
      handlers.onRemove(line.id);
    } else {
      handlers.onUpdate(line.id, original);
      onClose();
    }
  };
  const applyOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      apply();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <div className="my-3 rounded-xl border border-lineSecondary bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-x-2">
        <h2 className="text-sm font-bold">{isNew ? `${text.add} ${label?.toLowerCase()}` : `${text.edit} ${label?.toLowerCase()}`}</h2>
        <span className={`text-xs font-semibold ${subtracts ? "text-red-700" : "text-green-700"}`}>
          {subtracts ? text.subtracted : text.added}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-x-3">
        <label htmlFor={`${fieldId}-description`} className="mb-1 text-xs font-semibold opacity-70">
          {text.description} <span className="font-normal">({text.optional})</span>
        </label>
        <label htmlFor={`${fieldId}-amount`} className="mb-1 text-xs font-semibold opacity-70">
          {isPercent ? text.percent : text.amount}
        </label>

        <input
          id={`${fieldId}-description`}
          type="text"
          value={line.description}
          onChange={(e) => handlers.onUpdate(line.id, { description: e.target.value })}
          onKeyDown={applyOnEnter}
          className="customInput h-9 w-full text-sm"
          placeholder={text.descriptionPlaceholder}
          maxLength={200}
        />
        <div className="relative">
          <AmountInput
            id={`${fieldId}-amount`}
            amount={isPercent ? (line.percent ?? 0) : line.amount}
            onChange={(value) => handlers.onUpdate(line.id, isPercent ? { percent: value } : { amount: value })}
            onKeyDown={applyOnEnter}
            autoFocus
          />
          <button
            type="button"
            onClick={() => handlers.onUpdate(line.id, { unit: isPercent ? "nok" : "percent" })}
            title={isPercent ? text.switchToNok : text.switchToPercent}
            aria-label={isPercent ? text.switchToNok : text.switchToPercent}
            className="absolute right-1.5 top-1/2 flex h-6 min-w-10 -translate-y-1/2 items-center justify-center gap-x-0.5 rounded-md bg-black/5 px-1.5 text-xs font-semibold transition-colors hover:bg-logoblue hover:text-white"
          >
            {isPercent ? "%" : "NOK"}
            <span aria-hidden className="text-[10px] opacity-60">⇄</span>
          </button>
        </div>

        <span />
        {isPercent ? (
          <p className="mt-1 text-right text-xs opacity-60">= {formatSumNOK(line.amount)} NOK</p>
        ) : (
          <span />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-2">
        <button
          type="button"
          onClick={cancel}
          className="h-9 rounded-lg border border-lineSecondary text-sm font-semibold transition-colors hover:bg-black/5"
        >
          {text.cancel}
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!canApply}
          className="h-9 rounded-lg bg-logoblue text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {text.apply}
        </button>
      </div>
    </div>
  );
}

function AdjustmentLineRows({
  lines,
  kinds,
  labels,
  handlers,
  text,
}: {
  lines: AdjustmentLine[];
  kinds: AdjustmentLineKind[];
  labels: Partial<Record<AdjustmentLineKind, string>>;
  handlers?: AdjustmentLineHandlers;
  text: AdjustmentRowText;
}) {
  const [editing, setEditing] = useState(() => ({
    knownIds: new Set(lines.map((line) => line.id)),
    editingIds: new Set<string>(),
  }));
  const tracked = trackNewAdjustmentLines(lines, editing.knownIds, editing.editingIds);
  if (tracked) setEditing(tracked);
  const editingIds = tracked?.editingIds ?? editing.editingIds;

  const setLineEditing = (id: string, open: boolean) =>
    setEditing((current) => {
      const next = new Set(current.editingIds);
      if (open) next.add(id);
      else next.delete(id);
      return { ...current, editingIds: next };
    });

  return (
    <>
      {lines
        .filter((line) => kinds.includes(line.kind))
        .map((line) => {
          const label = labels[line.kind];

          if (handlers && editingIds.has(line.id)) {
            return (
              <DraftAdjustmentRow
                key={line.id}
                line={line}
                label={label}
                handlers={handlers}
                onClose={() => setLineEditing(line.id, false)}
                text={text}
              />
            );
          }

          // Empty lines only exist as drafts; don't show them as "0 NOK" rows.
          if (line.amount === 0) return null;

          return (
            <AppliedAdjustmentRow
              key={line.id}
              line={line}
              label={label}
              onEdit={handlers ? () => setLineEditing(line.id, true) : undefined}
              onRemove={handlers ? () => handlers.onRemove(line.id) : undefined}
              text={text}
            />
          );
        })}
    </>
  );
}

// Footer of the calculator card: full-bleed halves split by a divider. The
// negative margins cancel .customContainer's 20px padding and the 19px radius
// (20px minus its 1px border) clips the hover fill to the card's corners.
function AddAdjustmentLineButtons({
  actions,
  onAdd,
  className = "",
}: {
  actions: Array<{ kind: AdjustmentLineKind; label: string }>;
  onAdd: (kind: AdjustmentLineKind) => void;
  className?: string;
}) {
  return (
    <div
      className={`-mx-5 -mb-5 grid overflow-hidden rounded-b-[19px] border-t-2 ${className}`}
      style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}
    >
      {actions.map((action, index) => (
        <button
          key={action.kind}
          type="button"
          onClick={() => onAdd(action.kind)}
          className={[
            "py-5 text-base font-semibold text-logoblue transition-colors hover:bg-black/5 active:bg-black/10",
            index > 0 ? "border-l-2 border-inherit" : "",
          ].join(" ")}
        >
          + {action.label}
        </button>
      ))}
    </div>
  );
}

type Props = {
  productBreakdowns: ProductBreakdown[];
  priceLookup: PriceLookup;
  forcedTotalExVat?: number;
  forcedSubcontractorTotal?: number;
  adminView?: boolean;
  onPriceChange?: (exVat: number, subcontractorPrice: number) => void;
  adjustmentLines?: AdjustmentLine[];
  adjustmentLineHandlers?: AdjustmentLineHandlers;
  sidebarMode?: boolean;
  locale?: BookingUiLocale;
  hideWordpressImportWarnings?: boolean;
  showSubcontractorPrices?: boolean;
  onToggleLineNulled?: (cardId: number, lineKey: string, nulled: boolean) => void;
  onToggleOrderExtraLineNulled?: (lineKey: string, nulled: boolean) => void;
};

export function CalculatorDisplayNew({
  productBreakdowns,
  priceLookup,
  forcedTotalExVat,
  forcedSubcontractorTotal,
  adminView = false,
  onPriceChange,
  adjustmentLines = EMPTY_ADJUSTMENT_LINES,
  adjustmentLineHandlers,
  sidebarMode = false,
  locale = "en",
  hideWordpressImportWarnings,
  showSubcontractorPrices = false,
  onToggleLineNulled,
  onToggleOrderExtraLineNulled,
}: Props) {
  const t = (text: string) => bookingText(locale, text);
  const adjustments = useMemo(() => sumAdjustmentLines(adjustmentLines), [adjustmentLines]);

  const result = useMemo(
    () =>
      calculateBookingPricing({
        productBreakdowns,
        priceLookup,
        adjustments,
      }),
    [productBreakdowns, priceLookup, adjustments],
  );

const displayTotals = useMemo(() => {
  if (forcedTotalExVat == null && forcedSubcontractorTotal == null) return result.totals;

  const totalExVat = roundPriceRule(forcedTotalExVat ?? result.totals.totalExVat);
  const vat = roundPriceRule(totalExVat * 0.25);
  const totalIncVat = roundPriceRule(totalExVat + vat);
  const subcontractorTotal = roundPriceRule(forcedSubcontractorTotal ?? result.totals.subcontractorTotal);

  return { ...result.totals, totalExVat, vat, totalIncVat, subcontractorTotal };
}, [forcedSubcontractorTotal, forcedTotalExVat, result.totals]);

const onPriceChangeRef = useRef(onPriceChange);

useEffect(() => {
    onPriceChangeRef.current = onPriceChange;
  });

const lastReportedRef = useRef<{ exVat: number; sub: number } | null>(null);

useEffect(() => {
  const exVat = roundPriceRule(result.totals.totalExVat);
  const sub = roundPriceRule(result.totals.subcontractorTotal);

  if (lastReportedRef.current?.exVat === exVat && lastReportedRef.current?.sub === sub) return;

  lastReportedRef.current = { exVat, sub };
  onPriceChangeRef.current?.(exVat, sub);
}, [result.totals.totalExVat, result.totals.subcontractorTotal]);

  return (
    <section className={["w-full customContainer rounded-2xl px-4 bg-mainPrimary", sidebarMode ? "max-h-[calc(100vh-10rem)] overflow-y-auto" : ""].join(" ")}>
      <div className="border-b-2 border-lineSecondary py-4">
        {result.breakdowns.length === 0 ? (
          <p className="text-sm opacity-30">{t("No products selected.")}</p>
        ) : (
          result.breakdowns.map((product, productIdx) => (
            <div
              key={productIdx}
              className={[
                "mb-4 last:mb-0",
                product.readOnly && !hideWordpressImportWarnings ? "rounded-lg border border-gray-300 bg-gray-100 p-3 text-gray-600" : "",
              ].join(" ")}
            >
              <h1 className="font-bold text-md mb-2">
                {product.productName}
                {product.productModelNumber ? <span className="ml-1 text-sm font-normal text-gray-500">({product.productModelNumber})</span> : null}
              </h1>
              {product.comment && !hideWordpressImportWarnings ? <p className="mb-2 text-sm font-semibold text-gray-600">{product.comment}</p> : null}

              {product.lines.length === 0 ? (
                <p className="text-sm opacity-30 ml-2">{t("No services selected for this product.")}</p>
              ) : (
                product.lines.map((line, idx) => {
                  const isLineNulled = showSubcontractorPrices ? line.nulledForSubcontractor : line.nulledForCustomer;

                  return (
                    <div key={idx} className="priceRow ml-2">
                      <h1 className="text-sm flex items-center gap-x-2">
                        {adminView && (product.cardId != null || product.isOrderExtras) && line.lineKey != null && (
                          <input
                            type="checkbox"
                            title={t("Set to 0")}
                            aria-label={t("Set to 0")}
                            checked={line.nulledForCustomer ?? false}
                            onChange={(e) =>
                              product.isOrderExtras
                                ? onToggleOrderExtraLineNulled?.(line.lineKey as string, e.target.checked)
                                : onToggleLineNulled?.(product.cardId as number, line.lineKey as string, e.target.checked)
                            }
                          />
                        )}
                        <span className={isLineNulled ? "line-through opacity-60" : ""}>
                          {line.qty > 1 && <span className="opacity-70 mr-1">x{formatQty(line.qty)}</span>}

                          {line.code && <span className="text-logoblue mr-1">({line.code})</span>}

                          {line.label}
                        </span>
                      </h1>

                      <p className={["font-semibold text-sm whitespace-nowrap", isLineNulled ? "line-through opacity-60" : ""].join(" ")}>
                        {formatNOK(showSubcontractorPrices ? (line.subcontractorLineTotal ?? 0) : line.lineTotal)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          ))
        )}
      </div>

      <div className="pb-4">
        <AdjustmentLineRows
          lines={adjustmentLines}
          // Partner read-only view (showSubcontractorPrices) shows the partner's
          // own minus/plus rows instead of the customer's discount/extra.
          kinds={showSubcontractorPrices ? ["subcontractorMinus", "subcontractorPlus"] : ["discount", "extra"]}
          labels={{ discount: t("Discount"), extra: t("Extra"), subcontractorMinus: "Minus", subcontractorPlus: "Plus" }}
          handlers={adminView ? adjustmentLineHandlers : undefined}
          text={{
            description: t("Description"),
            descriptionPlaceholder: t("e.g. Damaged packaging"),
            optional: t("optional"),
            amount: t("Amount (ex VAT)"),
            remove: t("Remove"),
            add: t("Add"),
            apply: t("Apply"),
            edit: t("Edit"),
            cancel: t("Cancel"),
            subtracted: t("Subtracted from total"),
            added: t("Added to total"),
            percent: t("Percent"),
            switchToPercent: t("Switch to %"),
            switchToNok: t("Switch to NOK"),
          }}
        />

        <div className="priceRow">
          <h1 className="font-bold text-2xl">{t("Total")}</h1>
          <p className="font-bold text-2xl">{formatSumNOK(displayTotals.totalExVat)} NOK</p>
        </div>

        <div className="priceRow">
          <h1 className="text-md">{t("VAT (25%)")}</h1>
          <p className="font-semibold">{formatSumNOK(displayTotals.vat)} NOK</p>
        </div>

        <div className="priceRow">
          <h1 className="text-md">{t("Total incl. VAT")}</h1>
          <p className="font-semibold">{formatSumNOK(displayTotals.totalIncVat)} NOK</p>
        </div>
      </div>

      {adminView && adjustmentLineHandlers && (
        <AddAdjustmentLineButtons
          className="border-lineSecondary"
          actions={[
            { kind: "discount" as const, label: t("Add discount") },
            { kind: "extra" as const, label: t("Add extra") },
          ]}
          onAdd={adjustmentLineHandlers.onAdd}
        />
      )}
    </section>
  );
}

type SubcontractorProps = {
  productBreakdowns: ProductBreakdown[];
  priceLookup: PriceLookup;
  adjustmentLines?: AdjustmentLine[];
  adjustmentLineHandlers?: AdjustmentLineHandlers;
  onToggleLineNulled?: (cardId: number, lineKey: string, nulled: boolean) => void;
  onToggleOrderExtraLineNulled?: (lineKey: string, nulled: boolean) => void;
};

export function SubcontractorCalculatorDisplay({
  productBreakdowns,
  priceLookup,
  adjustmentLines = EMPTY_ADJUSTMENT_LINES,
  adjustmentLineHandlers,
  onToggleLineNulled,
  onToggleOrderExtraLineNulled,
}: SubcontractorProps) {
  const { subcontractorMinus, subcontractorPlus } = useMemo(
    () => sumAdjustmentLines(adjustmentLines),
    [adjustmentLines],
  );
  const result = useMemo(
    () =>
      calculateBookingPricing({
        productBreakdowns,
        priceLookup,
        adjustments: {
          rabatt: "",
          leggTil: "",
          subcontractorMinus,
          subcontractorPlus,
        },
      }),
    [productBreakdowns, priceLookup, subcontractorMinus, subcontractorPlus],
  );

  return (
    <section className="w-full customContainer rounded-2xl px-4 mt-4 bg-amber-50 border border-amber-200">
      <div className="border-b-2 border-amber-200 py-3 flex items-center gap-2">
        <h2 className="font-bold text-amber-800 text-sm uppercase tracking-wide">
          Partner View
        </h2>
      </div>

      <div className="border-b-2 border-amber-200 py-4">
        {result.breakdowns.length === 0 ? (
          <p className="text-sm opacity-30">No products selected.</p>
        ) : (
          result.breakdowns.map((product, productIdx) => (
            <div key={productIdx} className="mb-4 last:mb-0">
              <h1 className="font-bold text-md mb-2">{product.productName}</h1>
              {product.lines.length === 0 ? (
                <p className="text-sm opacity-30 ml-2">No services selected for this product.</p>
              ) : (
                product.lines.map((line, idx) => (
                  <div key={idx} className="priceRow ml-2">
                    <h1 className="text-sm flex items-center gap-x-2">
                      {(product.cardId != null || product.isOrderExtras) && line.lineKey != null && (
                        <input
                          type="checkbox"
                          title="Set to 0"
                          aria-label="Set to 0"
                          checked={line.nulledForSubcontractor ?? false}
                          onChange={(e) =>
                            product.isOrderExtras
                              ? onToggleOrderExtraLineNulled?.(line.lineKey as string, e.target.checked)
                              : onToggleLineNulled?.(product.cardId as number, line.lineKey as string, e.target.checked)
                          }
                        />
                      )}
                      <span className={line.nulledForSubcontractor ? "line-through opacity-60" : ""}>
                        {line.qty > 1 && (
                          <span className="opacity-70 mr-1">x{formatQty(line.qty)}</span>
                        )}
                        {line.code && (
                          <span className="text-amber-700 mr-1">({line.code})</span>
                        )}
                        {line.label}
                      </span>
                    </h1>
                    <p className={["font-semibold text-sm whitespace-nowrap", line.nulledForSubcontractor ? "line-through opacity-60" : ""].join(" ")}>
                      {formatNOK(line.subcontractorLineTotal ?? 0)}
                    </p>
                  </div>
                ))
              )}
            </div>
          ))
        )}
      </div>

      <div className="pb-4">

        <AdjustmentLineRows
          lines={adjustmentLines}
          kinds={["subcontractorMinus", "subcontractorPlus"]}
          labels={{ subcontractorMinus: "Minus", subcontractorPlus: "Plus" }}
          handlers={adjustmentLineHandlers}
          text={{
            description: "Description",
            descriptionPlaceholder: "e.g. Waiting time",
            optional: "optional",
            amount: "Amount",
            remove: "Remove",
            add: "Add",
            apply: "Apply",
            edit: "Edit",
            cancel: "Cancel",
            subtracted: "Subtracted from partner total",
            added: "Added to partner total",
            percent: "Percent",
            switchToPercent: "Switch to %",
            switchToNok: "Switch to NOK",
          }}
        />

        <div className="priceRow">
          <h1 className="font-bold text-2xl">Total</h1>
          <p className="font-bold text-2xl">
            {formatSumNOK(result.totals.subcontractorTotal)} NOK
          </p>
        </div>
      </div>

      {adjustmentLineHandlers && (
        <AddAdjustmentLineButtons
          className="border-amber-200"
          actions={[
            { kind: "subcontractorMinus" as const, label: "Add partner minus" },
            { kind: "subcontractorPlus" as const, label: "Add partner plus" },
          ]}
          onAdd={adjustmentLineHandlers.onAdd}
        />
      )}
    </section>
  );
}
