"use client";

import type { BookingArchiveViewMode, OrderCalculatorItem } from "@/app/_components/Dahsboard/booking/archive/types";
import { bookingStatusText } from "@/lib/booking/bookingUiText";
import { formatDisplayDate } from "@/lib/dateDisplay";

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
  calculatorItems: OrderCalculatorItem[];
  createdBy?: string;
  lastEditedBy?: string;
};

type Props = {
  open: boolean;
  order: ReadOnlyOrder | null;
  viewMode?: BookingArchiveViewMode;
  onClose: () => void;
  onContactClick?: () => void;
};

type PdfDetailRow = {
  label: string;
  value: string;
};

type CalculatorLine = {
  label: string;
  code: string;
  qty: number;
  lineTotal: number;
};

type CalculatorGroup = {
  title: string;
  modelNumber: string;
  lines: CalculatorLine[];
};

type CalculatorDisplayData = {
  groups: CalculatorGroup[];
  totalExVat: number;
  vat: number;
  totalIncVat: number;
  discount: number;
  extra: number;
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

function parseNokAdjustment(value: string | null | undefined) {
  const normalized = (value ?? "").replace(/[^\d.,-]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
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

function getCalculatorDisplayData(order: ReadOnlyOrder, viewMode: BookingArchiveViewMode | undefined): CalculatorDisplayData {
  const useSubcontractorPrices = viewMode === "SUBCONTRACTOR";
  const groups = new Map<number, CalculatorGroup>();

  for (const item of order.calculatorItems ?? []) {
    const current = groups.get(item.cardId) ?? {
      title: item.productName || "Produkt",
      modelNumber: item.productModelNumber,
      lines: [],
    };

    if (!groups.has(item.cardId)) {
      groups.set(item.cardId, current);
    }

    if (item.itemType === "PRODUCT_CARD" || !item.optionLabel.trim()) {
      continue;
    }

    const priceCents = useSubcontractorPrices ? item.subcontractorPriceCents : item.customerPriceCents;

    if (priceCents == null) {
      continue;
    }

    current.lines.push({
      label: item.optionLabel,
      code: item.optionCode,
      qty: item.quantity,
      lineTotal: roundMoney((priceCents * item.quantity) / 100),
    });
  }

  const totalExVat = roundMoney(getVisibleOrderPrice(order, viewMode));
  const hasWordpressReadOnlyRows = (order.calculatorItems ?? []).some((item) => item.optionCode === "WP_PRICE");
  const discount = hasWordpressReadOnlyRows
    ? 0
    : viewMode === "ORDER_CREATOR"
      ? parseNokAdjustment(order.rabatt)
      : viewMode === "SUBCONTRACTOR"
        ? parseNokAdjustment(order.subcontractorMinus)
        : 0;

  const hasWordpressItems = (order.calculatorItems ?? []).some((item) => item.itemType === "EXTRA_OPTION" && item.optionCode);

  const extra = hasWordpressItems
    ? 0
    : viewMode === "ORDER_CREATOR"
      ? parseNokAdjustment(order.leggTil)
      : viewMode === "SUBCONTRACTOR"
        ? parseNokAdjustment(order.subcontractorPlus)
        : 0;
  const vat = roundMoney(totalExVat * 0.25);

  return {
    groups: Array.from(groups.values()).filter((group) => group.lines.length > 0),
    totalExVat,
    vat,
    totalIncVat: roundMoney(totalExVat + vat),
    discount,
    extra,
  };
}

function renderCalculatorHtml(data: CalculatorDisplayData) {
  const groupsHtml =
    data.groups.length > 0
      ? data.groups
          .map(
            (group) => `
              <div class="calculator-group">
                <h2>${escapeHtml(group.title)}${group.modelNumber ? ` <span>(${escapeHtml(group.modelNumber)})</span>` : ""}</h2>
                ${group.lines
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
                  .join("")}
              </div>
            `,
          )
          .join("")
      : `<p class="empty-calculator">Ingen varelinjer lagret.</p>`;

  return `
    <aside class="calculator-card">
      <div class="calculator-lines">${groupsHtml}</div>
      <div class="calculator-summary">
        ${data.discount !== 0 ? `<div class="priceRow"><div>Rabatt</div><strong>-${escapeHtml(formatMoney(data.discount))}</strong></div>` : ""}
        ${data.extra !== 0 ? `<div class="priceRow"><div>Ekstra</div><strong>+${escapeHtml(formatMoney(data.extra))}</strong></div>` : ""}
        <div class="priceRow total-row"><div>Total</div><strong>${escapeHtml(formatMoney(data.totalExVat, { forceDecimals: true }))}</strong></div>
        <div class="priceRow"><div>MVA (25%)</div><strong>${escapeHtml(formatMoney(data.vat, { forceDecimals: true }))}</strong></div>
        <div class="priceRow"><div>Total inkl. MVA</div><strong>${escapeHtml(formatMoney(data.totalIncVat, { forceDecimals: true }))}</strong></div>
      </div> 
    </aside>
  `;
}

function downloadOrderPdf(order: ReadOnlyOrder, viewMode: BookingArchiveViewMode | undefined) {
  const totalExVat = getVisibleOrderPrice(order, viewMode);
  const vat = totalExVat * 0.25;
  const totalIncVat = totalExVat + vat;
  const usePdfCalculatorLayout = isCalculatorPdfView(viewMode);
  const calculatorData = getCalculatorDisplayData(order, viewMode);
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
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; font-size: 12px; }
          h1 { font-size: 20px; margin: 0 0 18px; }
          .pdf-layout { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 18px; align-items: start; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #d8dee8; padding: 8px 10px; vertical-align: top; }
          th { width: 190px; text-align: left; background: #f8fafc; font-weight: 700; }
          .calculator-card { border: 1px solid #d8dee8; border-radius: 16px; box-shadow: 0 0 10px rgba(0,0,0,0.1); padding: 16px; background: #f8fafc; }
          .calculator-lines { border-bottom: 2px solid #d8dee8; padding-bottom: 12px; }
          .calculator-group { margin-bottom: 14px; }
          .calculator-group:last-child { margin-bottom: 0; }
          .calculator-group h2 { font-size: 14px; margin: 0 0 8px; }
          .calculator-group h2 span { color: #64748b; font-size: 12px; font-weight: 400; }
          .priceRow { border-bottom: 1px solid #cfcfcf; padding: 4px 0; display: flex; justify-content: space-between; gap: 16px; }
          .priceRow:last-child { border-bottom: 0; }
          .line-code { color: #2563eb; }
          .calculator-summary { padding-top: 12px; }
          .total-row { font-size: 20px; font-weight: 700; }
          .empty-calculator { margin: 0; color: #64748b; }
        </style>
      </head>
      <body>
        <h1>Ordredetaljer</h1>
        <div class="pdf-layout">
          <table><tbody>${detailRowsHtml}</tbody></table>
          ${renderCalculatorHtml(calculatorData)}
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

function OrderPdfCalculator({ data }: { data: CalculatorDisplayData }) {
  return (
    <section className="w-full customContainer rounded-2xl bg-mainPrimary px-4">
      <div className="border-b-2 border-lineSecondary py-4">
        {data.groups.length === 0 ? (
          <p className="text-sm opacity-30">Ingen varelinjer lagret.</p>
        ) : (
          data.groups.map((group, groupIndex) => (
            <div key={`${group.title}-${groupIndex}`} className="mb-4 last:mb-0">
              <h1 className="mb-2 text-md font-bold">
                {group.title}
                {group.modelNumber ? <span className="ml-1 text-sm font-normal text-gray-500">({group.modelNumber})</span> : null}
              </h1>

              {group.lines.map((line, lineIndex) => (
                <div key={`${line.label}-${lineIndex}`} className="priceRow ml-2">
                  <h1 className="text-sm">
                    {line.qty > 1 ? <span className="mr-1 opacity-70">x{formatQty(line.qty)}</span> : null}
                    {line.code ? <span className="mr-1 text-logoblue">({line.code})</span> : null}
                    {line.label}
                  </h1>

                  <p className="whitespace-nowrap text-sm font-semibold">{formatMoney(line.lineTotal)}</p>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="pb-4">
        {data.discount !== 0 ? (
          <div className="priceRow">
            <h1 className="text-md">Rabatt</h1>
            <p className="font-semibold">-{formatMoney(data.discount)}</p>
          </div>
        ) : null}

        {data.extra !== 0 ? (
          <div className="priceRow">
            <h1 className="text-md">Ekstra</h1>
            <p className="font-semibold">+{formatMoney(data.extra)}</p>
          </div>
        ) : null}

        <div className="priceRow">
          <h1 className="text-2xl font-bold">Total</h1>
          <p className="text-2xl font-bold">{formatMoney(data.totalExVat, { forceDecimals: true })}</p>
        </div>

        <div className="priceRow">
          <h1 className="text-md">MVA (25%)</h1>
          <p className="font-semibold">{formatMoney(data.vat, { forceDecimals: true })}</p>
        </div>

        <div className="priceRow">
          <h1 className="text-md">Total inkl. MVA</h1>
          <p className="font-semibold">{formatMoney(data.totalIncVat, { forceDecimals: true })}</p>
        </div>
      </div>
    </section>
  );
}

export default function ReadOnlyOrderModal({ open, order, viewMode, onClose, onContactClick }: Props) {
  if (!open || !order) return null;

  const totalExVat = getVisibleOrderPrice(order, viewMode);
  const vat = totalExVat * 0.25;
  const totalIncVat = totalExVat + vat;
  const usePdfCalculatorLayout = isCalculatorPdfView(viewMode);
  const pdfDetailRows = getPdfDetailRows(order);
  const calculatorData = getCalculatorDisplayData(order, viewMode);

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

            <OrderPdfCalculator data={calculatorData} />
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
                <span className="font-semibold">Status:</span> {order.status ? bookingStatusText("nb", order.status) : "-"}
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
          {onContactClick ? (
            <button type="button" onClick={onContactClick} className="customButtonDefault">
              Contact
            </button>
          ) : null}

          <button type="button" onClick={() => downloadOrderPdf(order, viewMode)} className="customButtonEnabled">
            Last ned PDF
          </button>
        </div>
      </div>
    </div>
  );
}
