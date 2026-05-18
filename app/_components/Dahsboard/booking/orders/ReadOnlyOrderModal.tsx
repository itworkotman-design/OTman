"use client";

import { useEffect, useMemo, useState } from "react";
import type { BookingArchiveViewMode } from "@/app/_components/Dahsboard/booking/archive/types";
import { CalculatorDisplayNew } from "@/app/_components/Dahsboard/booking/create/CalculatorDisplay";
import { bookingStatusText } from "@/lib/booking/bookingUiText";
import { formatDisplayDate } from "@/lib/dateDisplay";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import {
  normalizeSavedProductCard,
  type CatalogProduct,
  type CatalogSpecialOption,
  type SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import {
  applyOrderPricingSnapshot,
  getSavedOrderPricingSnapshot,
} from "@/lib/booking/pricing/snapshot";
import {
  buildCalculatorBreakdownsWithOrderExtras,
  parseDistanceKm,
  parsePriceSetting,
} from "@/lib/booking/pricing/orderCalculatorExtras";
import type { PriceListSettings } from "@/lib/products/priceListSettings";
import type { PriceLookup } from "@/lib/booking/pricing/types";

type ReadOnlyOrder = {
  id: string;
  status: string;
  statusNotes: string;
  deliveryDate: string;
  timeWindow: string;
  drivingDistance: string;
  customerLabel: string;
  customerName: string;
  orderNumber: string;
  phone: string;
  email: string;
  floorNo: string;
  lift: string;
  pickupAddress: string;
  extraPickupAddress: string[];
  deliveryAddress: string;
  returnAddress?: string;
  productsSummary: string;
  deliveryTypeSummary: string;
  servicesSummary: string;
  description: string;
  cashierName: string;
  cashierPhone: string;
  customerComments: string;
  driverInfo: string;
  createdAt: string;
  updatedAt: string;
  priceExVat: number;
  priceSubcontractor?: number;
  rabatt: string;
  leggTil: string;
  subcontractorMinus: string;
  subcontractorPlus: string;
  createdBy?: string;
  lastEditedBy?: string;
};

type Props = {
  open: boolean;
  order: ReadOnlyOrder | null;
  viewMode?: BookingArchiveViewMode;
  locale?: BookingUiLocale;
  onClose: () => void;
};

type FullOrderResponse = {
  ok: boolean;
  order?: {
    id: string;
    legacyWordpressOrderId?: number | null;
    priceListId: string;
    productCards: SavedProductCard[];
    pickupAddress: string;
    deliveryAddress: string;
    returnAddress: string;
    drivingDistance: string;
    extraPickups: Array<{
      address: string;
      phone: string;
      email: string;
      sendEmail: boolean;
    }>;
    expressDelivery: boolean;
    deviation: string;
    feeExtraWork: boolean;
    extraWorkMinutes: number;
    feeAddToOrder: boolean;
    priceExVat: number;
    priceSubcontractor: number;
  };
  reason?: string;
};

type CatalogResponse = {
  ok: boolean;
  products?: CatalogProduct[];
  specialOptions?: CatalogSpecialOption[];
  priceListSettings?: PriceListSettings;
  reason?: string;
};

type AdminCalculatorState = {
  productBreakdowns: ReturnType<typeof buildCalculatorBreakdownsWithOrderExtras>;
  priceLookup: PriceLookup;
  priceExVat: number;
  priceSubcontractor: number;
  hasWordpressReadOnlyRows: boolean;
};

type PdfDetailRow = {
  label: string;
  value: string;
};


function formatCell(value: string | null | undefined) {
  if (!value || !value.trim()) return "-";
  return value;
}

function formatMoney(value: number | null | undefined, options?: { forceDecimals?: boolean }) {
  if (typeof value !== "number") return "-";

  const isWhole = Number.isInteger(value);

  return `${value.toLocaleString("no-NO", {
    minimumFractionDigits: options?.forceDecimals ? 2 : isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  })} NOK`;
}

function formatExtraPickup(value: string[] | null | undefined) {
  if (!value || value.length === 0) return "-";
  return value.join(", ");
}

function getVisibleOrderPrice(order: ReadOnlyOrder, viewMode: BookingArchiveViewMode | undefined) {
  return viewMode === "SUBCONTRACTOR" ? (order.priceSubcontractor ?? 0) : (order.priceExVat ?? 0);
}

function isCalculatorPdfView(viewMode: BookingArchiveViewMode | undefined) {
  return viewMode === "SUBCONTRACTOR" || viewMode === "ORDER_CREATOR";
}



function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatQty(qty: number) {
  const rounded = Math.round(qty * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatLift(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "-";
  if (["yes", "ja", "true", "1"].includes(normalized)) return "Ja";
  if (["no", "nei", "false", "0"].includes(normalized)) return "Nei";
  return value ?? "-";
}

function getPdfDetailRows(order: ReadOnlyOrder): PdfDetailRow[] {
  return [
    { label: "Bestiller", value: formatCell(order.createdBy) },
    { label: "Leveringsdato", value: formatDisplayDate(order.deliveryDate) },
    { label: "Henteadresse", value: formatCell(order.pickupAddress) },
    { label: "Leveringsadresse", value: formatCell(order.deliveryAddress) },
    { label: "Total kjøreavstand", value: formatCell(order.drivingDistance) },
    { label: "Tidsvindu for levering", value: formatCell(order.timeWindow) },
    { label: "Bilagsnummer", value: formatCell(order.orderNumber) },
    { label: "Beskrivelse", value: formatCell(order.description) },
    { label: "Kundens navn", value: formatCell(order.customerName) },
    { label: "Kundens epostadresse", value: formatCell(order.email) },
    { label: "Kundens telefon", value: formatCell(order.phone) },
    { label: "Etasje nr", value: formatCell(order.floorNo) },
    { label: "Heis", value: formatLift(order.lift) },
    { label: "Kassererens navn", value: formatCell(order.cashierName) },
    { label: "Kassererens telefon", value: formatCell(order.cashierPhone) },
    { label: "Bestillingsdato", value: formatDisplayDate(order.createdAt) },
  ];
}


function renderAdminCalculatorHtml(state: AdminCalculatorState) {
  const result = calculateBookingPricing({
    productBreakdowns: state.productBreakdowns,
    priceLookup: state.priceLookup,
    adjustments: {
      rabatt: "",
      leggTil: "",
      subcontractorMinus: "",
      subcontractorPlus: "",
    },
  });

  const groupsHtml =
    result.breakdowns.length > 0
      ? result.breakdowns
          .map((product) => {
            const linesHtml = product.lines
              .map(
                (line) => `
                  <div class="priceRow">
                    <div>${line.qty > 1 ? `x${escapeHtml(formatQty(line.qty))} ` : ""}${
                      line.code ? `<span class="line-code">(${escapeHtml(line.code)})</span> ` : ""
                    }${escapeHtml(line.label)}</div>
                    <strong>${escapeHtml(formatMoney(line.lineTotal))}</strong>
                  </div>
                `,
              )
              .join("");

            return `
              <div class="calculator-group">
                <h2>${escapeHtml(product.productName)}</h2>
                ${linesHtml || `<p class="empty-calculator">Ingen varelinjer lagret.</p>`}
              </div>
            `;
          })
          .join("")
      : `<p class="empty-calculator">Ingen varelinjer lagret.</p>`;

  const totalExVat = roundMoney(state.priceExVat);
  const vat = roundMoney(totalExVat * 0.25);
  const totalIncVat = roundMoney(totalExVat + vat);

  return `
    <aside class="calculator-card">
      <div class="calculator-lines">${groupsHtml}</div>
      <div class="calculator-summary">
        <div class="priceRow total-row"><div>Total</div><strong>${escapeHtml(formatMoney(totalExVat, { forceDecimals: true }))}</strong></div>
        <div class="priceRow"><div>MVA (25%)</div><strong>${escapeHtml(formatMoney(vat, { forceDecimals: true }))}</strong></div>
        <div class="priceRow"><div>Total inkl. MVA</div><strong>${escapeHtml(formatMoney(totalIncVat, { forceDecimals: true }))}</strong></div>
      </div>
    </aside>
  `;
}



function downloadOrderPdf(order: ReadOnlyOrder, viewMode: BookingArchiveViewMode | undefined, calculatorState: AdminCalculatorState | null) {
  const totalExVat = getVisibleOrderPrice(order, viewMode);
  const vat = totalExVat * 0.25;
  const totalIncVat = totalExVat + vat;
  const usePdfCalculatorLayout = isCalculatorPdfView(viewMode);
  const detailRowsHtml = getPdfDetailRows(order)
    .map(
      (row) => `
        <tr>
          <th>${escapeHtml(row.label)}</th>
          <td>${escapeHtml(row.value)}</td>
        </tr>
      `,
    )
    .join("");

  const content = usePdfCalculatorLayout
    ? `
    <html>
      <head>
        <title>Ordre ${escapeHtml(order.orderNumber || order.id)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #111; font-size: 12px; }
          h1 { font-size: 20px; margin: 0 0 18px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #d8dee8; padding: 8px 10px; vertical-align: top; }
          th { width: 190px; text-align: left; background: #f8fafc; font-weight: 700; }
          .pdf-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 320px;
            gap: 18px;
            align-items: start;
          }

          .calculator-card {
            position: static;
            width: auto;
            max-width: 320px;
            border: 1px solid #d8dee8;
            border-radius: 16px;
            padding: 16px;
            box-sizing: border-box;
          }
          .calculator-lines { border-bottom: 2px solid #d8dee8; padding-bottom: 12px; }
          .calculator-group { margin-bottom: 14px; }
          .calculator-group:last-child { margin-bottom: 0; }
          .calculator-group h2 { font-size: 14px; margin: 0 0 8px; }
          .calculator-group h2 span { color: #64748b; font-size: 12px; font-weight: 400; }
          .priceRow {
            border-bottom: 1px solid #cfcfcf;
            padding: 4px 0;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
          }

          .priceRow > div:first-child {
            flex: 1;
            min-width: 0;
          }

          .priceRow strong {
            white-space: nowrap;
            flex-shrink: 0;
          }

          .priceRow:last-child {
            border-bottom: 0;
          }
          .calculator-summary { padding-top: 12px; }
          .total-row { font-size: 20px; font-weight: 700; }
          .empty-calculator { margin: 0; color: #64748b; }
        </style>
      </head>
      <body>
        <h1>Ordredetaljer</h1>
        <div class="pdf-layout">
          <table><tbody>${detailRowsHtml}</tbody></table>
          ${calculatorState ? renderAdminCalculatorHtml(calculatorState) : `<p>Calculator missing data.</p>`}
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>
  `
    : `
    <html>
      <head>
        <title>Ordre ${escapeHtml(order.orderNumber || order.id)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; font-size: 14px; }
          h1 { font-size: 20px; margin-bottom: 20px; }
          .row { margin-bottom: 8px; }
          .label { font-weight: 700; }
          .divider { border-top: 1px solid #ddd; margin: 16px 0; }
          .totals { margin-top: 16px; background: #f8fafc; border-radius: 8px; padding: 12px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .total-row.big { font-size: 18px; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>Ordredetaljer</h1>

        <div class="row"><span class="label">Butikk:</span> ${escapeHtml(order.createdBy || "-")}</div>
        <div class="row"><span class="label">Kundenavn:</span> ${escapeHtml(order.customerName || "-")}</div>
        <div class="row"><span class="label">Bilagsnummer:</span> ${escapeHtml(order.orderNumber || "-")}</div>
        <div class="row"><span class="label">Leveringsdato:</span> ${escapeHtml(formatDisplayDate(order.deliveryDate))}</div>
        <div class="row"><span class="label">Tidsvindu:</span> ${escapeHtml(order.timeWindow || "-")}</div>
        <div class="row"><span class="label">Telefon:</span> ${escapeHtml(order.phone || "-")}</div>
        <div class="row"><span class="label">Henteadresse:</span> ${escapeHtml(order.pickupAddress || "-")}</div>
        <div class="row"><span class="label">Ekstra hentesteder:</span> ${escapeHtml(formatExtraPickup(order.extraPickupAddress))}</div>
        <div class="row"><span class="label">Leveringsadresse:</span> ${escapeHtml(order.deliveryAddress || "-")}</div>
        <div class="row"><span class="label">Returadresse:</span> ${escapeHtml(order.returnAddress || "-")}</div>
        <div class="row"><span class="label">Produkter:</span> ${escapeHtml(order.productsSummary || "-")}</div>
        <div class="row"><span class="label">Leveringstype:</span> ${escapeHtml(order.deliveryTypeSummary || "-")}</div>
        <div class="row"><span class="label">Montering / retur:</span> ${escapeHtml(order.servicesSummary || "-")}</div>
        <div class="row"><span class="label">Beskrivelse:</span> ${escapeHtml(order.description || "-")}</div>
        <div class="row"><span class="label">Kasserers navn:</span> ${escapeHtml(order.cashierName || "-")}</div>
        <div class="row"><span class="label">Kasserers telefon:</span> ${escapeHtml(order.cashierPhone || "-")}</div>
        <div class="row"><span class="label">Kundenotater:</span> ${escapeHtml(order.customerComments || "-")}</div>
        <div class="row"><span class="label">Sjåførinfo:</span> ${escapeHtml(order.driverInfo || "-")}</div>
        <div class="row"><span class="label">Status:</span> ${escapeHtml(order.status ? bookingStatusText("nb", order.status) : "-")}</div>
        <div class="row"><span class="label">Statusnotater:</span> ${escapeHtml(order.statusNotes || "-")}</div>

        <div class="divider"></div>

        <div class="totals">
          <div class="total-row big">
            <span>Total</span><span>${escapeHtml(formatMoney(totalExVat))}</span>
          </div>
          <div class="total-row">
            <span>MVA (25%)</span><span>${escapeHtml(formatMoney(vat))}</span>
          </div>
          <div class="total-row">
            <span>Total inkl. MVA</span><span>${escapeHtml(formatMoney(totalIncVat))}</span>
          </div>
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>
  `;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.open();
  win.document.write(content);
  win.document.close();
}

function useAdminCalculatorState(order: ReadOnlyOrder | null) {
  const [fullOrder, setFullOrder] = useState<FullOrderResponse["order"] | null>(null);
  const [catalog, setCatalog] = useState<{
    products: CatalogProduct[];
    specialOptions: CatalogSpecialOption[];
    priceListSettings: PriceListSettings;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!order) return;
    const currentOrder = order;

    let cancelled = false;

    async function loadCalculatorData() {
      try {
        setLoading(true);
        setError("");
        setFullOrder(null);
        setCatalog(null);

        const orderResponse = await fetch(`/api/orders/${currentOrder.id}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const orderData = (await orderResponse.json().catch(() => null)) as FullOrderResponse | null;

        if (!orderResponse.ok || !orderData?.ok || !orderData.order) {
          if (!cancelled) setError(orderData?.reason || "Failed to load order");
          return;
        }

        const catalogParams = new URLSearchParams();
        if (orderData.order.priceListId) {
          catalogParams.set("priceListId", orderData.order.priceListId);
        }

        const catalogResponse = await fetch(`/api/booking/catalog?${catalogParams.toString()}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const catalogData = (await catalogResponse.json().catch(() => null)) as CatalogResponse | null;

        if (!catalogResponse.ok || !catalogData?.ok || !catalogData.priceListSettings) {
          if (!cancelled) setError(catalogData?.reason || "Failed to load catalog");
          return;
        }

        if (!cancelled) {
          setFullOrder(orderData.order);
          setCatalog({
            products: catalogData.products ?? [],
            specialOptions: catalogData.specialOptions ?? [],
            priceListSettings: catalogData.priceListSettings,
          });
        }
      } catch {
        if (!cancelled) setError("Failed to load calculator");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCalculatorData();

    return () => {
      cancelled = true;
    };
  }, [order]);

  const calculatorState = useMemo(() => {
    if (!fullOrder || !catalog) return null;

    const productCards = fullOrder.productCards.map((card, index) => normalizeSavedProductCard(card, index));

    const hasWordpressReadOnlyRows = productCards.some((card) => Boolean(card.wordpressImportReadOnly));

    const savedPricingSnapshot = getSavedOrderPricingSnapshot(productCards);

    const pricingSource = applyOrderPricingSnapshot({
      catalogProducts: catalog.products,
      catalogSpecialOptions: catalog.specialOptions,
      priceListSettings: catalog.priceListSettings,
      pricingSnapshot: savedPricingSnapshot,
    });

    const shouldUseNativeDistancePricing = !fullOrder.legacyWordpressOrderId;

    const productBreakdowns = buildProductBreakdowns(productCards, pricingSource.catalogProducts, pricingSource.catalogSpecialOptions, {
      zeroBaseDeliveryPricesOver100Km: shouldUseNativeDistancePricing && parseDistanceKm(fullOrder.drivingDistance) > 100,
      xtraPalletPrice: parsePriceSetting(pricingSource.priceListSettings.xtraPallet.price),
      xtraPalletSubcontractorPrice: parsePriceSetting(pricingSource.priceListSettings.xtraPallet.subcontractorPrice),
    });

    return {
      productBreakdowns: buildCalculatorBreakdownsWithOrderExtras({
        productBreakdowns,
        priceListSettings: pricingSource.priceListSettings,
        deviation: fullOrder.deviation,
        drivingDistance: fullOrder.drivingDistance,
        expressDelivery: fullOrder.expressDelivery,
        extraWorkMinutes: fullOrder.extraWorkMinutes,
        feeAddToOrder: fullOrder.feeAddToOrder,
        feeExtraWork: fullOrder.feeExtraWork,
        extraPickups: fullOrder.extraPickups,
        shouldUseNativeDistancePricing,
      }),
      priceLookup: buildPriceLookup(pricingSource.catalogProducts, pricingSource.catalogSpecialOptions),
      priceExVat: fullOrder.priceExVat,
      priceSubcontractor: fullOrder.priceSubcontractor,
      hasWordpressReadOnlyRows,
    };
  }, [catalog, fullOrder]);

  return { calculatorState, loading, error };
}

function AdminStyleReadOnlyCalculator({
  calculatorState,
  loading,
  error,
  rabatt,
  leggTil,
  subcontractorMinus,
  subcontractorPlus,
  viewMode,
  locale,
}: {
  calculatorState: AdminCalculatorState | null;
  loading: boolean;
  error: string;
  rabatt: string;
  leggTil: string;
  subcontractorMinus: string;
  subcontractorPlus: string;
  viewMode?: BookingArchiveViewMode;
  locale?: BookingUiLocale;
}) {
  
  if (loading) return <p className="text-sm text-textColorThird">Laster kalkulator...</p>;
  if (error || !calculatorState) return <p className="text-sm text-red-600">{error || "Kalkulator mangler data."}</p>;

  const isSubcontractor = viewMode === "SUBCONTRACTOR";
  const hideWordpressImportWarnings = viewMode === "SUBCONTRACTOR" || viewMode === "ORDER_CREATOR";

  const hideSubcontractorAdjustments = isSubcontractor && calculatorState.hasWordpressReadOnlyRows;

  const calculatorLocale = locale ?? "nb";

  return (
    <CalculatorDisplayNew
      productBreakdowns={calculatorState.productBreakdowns}
      priceLookup={calculatorState.priceLookup}
      forcedTotalExVat={isSubcontractor ? calculatorState.priceSubcontractor : calculatorState.priceExVat}
      forcedSubcontractorTotal={calculatorState.priceSubcontractor}
      adminView={false}
      hideWordpressImportWarnings={hideWordpressImportWarnings}
      rabatt={isSubcontractor ? "" : rabatt}
      leggTil={isSubcontractor ? "" : leggTil}
      subcontractorMinus={isSubcontractor && !hideSubcontractorAdjustments ? subcontractorMinus : ""}
      subcontractorPlus={isSubcontractor && !hideSubcontractorAdjustments ? subcontractorPlus : ""}
      sidebarMode={false}
      locale={calculatorLocale}
    />
  );
}

export default function ReadOnlyOrderModal({ open, order, viewMode, locale, onClose }: Props) {
  const { calculatorState, loading: calculatorLoading, error: calculatorError } = useAdminCalculatorState(order);

  if (!open || !order) return null;

  const totalExVat = getVisibleOrderPrice(order, viewMode);
  const vat = totalExVat * 0.25;
  const totalIncVat = totalExVat + vat;
  const usePdfCalculatorLayout = isCalculatorPdfView(viewMode);
  const pdfDetailRows = getPdfDetailRows(order);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between">
          <h2 className="text-xl font-semibold">Ordredetaljer</h2>
          <button onClick={onClose} className="customButtonDefault h-8! w-8! rounded-full! px-0! py-0! text-sm">
            X
          </button>
        </div>

        {usePdfCalculatorLayout ? (
          <div className="grid max-h-[72vh] gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px]">
            <table className="w-full border-collapse text-sm text-slate-800">
              <tbody>
                {pdfDetailRows.map((row) => (
                  <tr key={row.label}>
                    <th className="w-[190] border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold">{row.label}</th>
                    <td className="border border-slate-200 px-3 py-2">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <AdminStyleReadOnlyCalculator
              calculatorState={calculatorState}
              loading={calculatorLoading}
              error={calculatorError}
              viewMode={viewMode}
              rabatt={order.rabatt}
              leggTil={order.leggTil}
              subcontractorMinus={order.subcontractorMinus}
              subcontractorPlus={order.subcontractorPlus}
              locale={locale ?? "nb"}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2 text-sm text-slate-800">
              <p>
                <span className="font-semibold">Butikk:</span> {formatCell(order.createdBy)}
              </p>
              <p>
                <span className="font-semibold">Kundenavn:</span> {formatCell(order.customerName)}
              </p>
              <p>
                <span className="font-semibold">Bilagsnummer:</span> {formatCell(order.orderNumber)}
              </p>
              <p>
                <span className="font-semibold">Leveringsdato:</span> {formatDisplayDate(order.deliveryDate)}
              </p>
              <p>
                <span className="font-semibold">Tidsvindu:</span> {formatCell(order.timeWindow)}
              </p>
              <p>
                <span className="font-semibold">Telefon:</span> {formatCell(order.phone)}
              </p>
              <p>
                <span className="font-semibold">Henteadresse:</span> {formatCell(order.pickupAddress)}
              </p>
              <p>
                <span className="font-semibold">Ekstra hentesteder:</span> {formatExtraPickup(order.extraPickupAddress)}
              </p>
              <p>
                <span className="font-semibold">Leveringsadresse:</span> {formatCell(order.deliveryAddress)}
              </p>
              <p>
                <span className="font-semibold">Returadresse:</span> {formatCell(order.returnAddress)}
              </p>
              <p>
                <span className="font-semibold">Produkter:</span> {formatCell(order.productsSummary)}
              </p>
              <p>
                <span className="font-semibold">Leveringstype:</span> {formatCell(order.deliveryTypeSummary)}
              </p>
              <p>
                <span className="font-semibold">Montering / retur:</span> {formatCell(order.servicesSummary)}
              </p>
              <p>
                <span className="font-semibold">Beskrivelse:</span> {formatCell(order.description)}
              </p>
              <p>
                <span className="font-semibold">Kasserers navn:</span> {formatCell(order.cashierName)}
              </p>
              <p>
                <span className="font-semibold">Kasserers telefon:</span> {formatCell(order.cashierPhone)}
              </p>
              <p>
                <span className="font-semibold">Kundenotater:</span> {formatCell(order.customerComments)}
              </p>
              <p>
                <span className="font-semibold">Sjåførinfo:</span> {formatCell(order.driverInfo)}
              </p>
              <p>
                <span className="font-semibold">Status:</span> {order.status ? bookingStatusText(locale ?? "en", order.status) : "-"}
              </p>
              <p>
                <span className="font-semibold">Statusnotater:</span> {formatCell(order.statusNotes)}
              </p>
              <p>
                <span className="font-semibold">Opprettet av:</span> {formatCell(order.createdBy)}
              </p>
              <p>
                <span className="font-semibold">Sist redigert av:</span> {formatCell(order.lastEditedBy)}
              </p>
            </div>

            <div className="mt-4 space-y-1 rounded-xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatMoney(totalExVat, { forceDecimals: true })}</span>
              </div>
              <div className="flex justify-between">
                <span>MVA (25%)</span>
                <span className="font-semibold">{formatMoney(vat, { forceDecimals: true })}</span>
              </div>
              <div className="flex justify-between">
                <span>Total inkl. MVA</span>
                <span className="font-semibold">{formatMoney(totalIncVat, { forceDecimals: true })}</span>
              </div>
            </div>
          </>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={usePdfCalculatorLayout && (!calculatorState || calculatorLoading)}
            onClick={() => downloadOrderPdf(order, viewMode, calculatorState)}
            className="customButtonEnabled disabled:cursor-not-allowed disabled:opacity-50"
          >
            Last ned PDF
          </button>
        </div>
      </div>
    </div>
  );
}
