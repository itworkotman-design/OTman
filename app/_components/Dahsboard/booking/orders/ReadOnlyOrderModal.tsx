"use client";

type Props = {
  open: boolean;
  order: {
    id: string;
    status: string;
    statusNotes: string;
    deliveryDate: string;
    timeWindow: string;
    customerLabel: string;
    customerName: string;
    orderNumber: string;
    phone: string;
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
    createdBy?: string;
    lastEditedBy?: string;
  } | null;
  onClose: () => void;
};

function formatCell(value: string | null | undefined) {
  if (!value || !value.trim()) return "-";
  return value;
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "-";
  return `NOK ${value.toLocaleString("no-NO")}`;
}

function formatExtraPickup(value: string[] | null | undefined) {
  if (!value || value.length === 0) return "-";
  return value.join(", ");
}

function downloadOrderPdf(order: NonNullable<Props["order"]>) {
  const totalExVat = order.priceExVat ?? 0;
  const vat = totalExVat * 0.25;
  const totalIncVat = totalExVat + vat;

  const content = `
    <html>
      <head>
        <title>Ordre ${order.orderNumber || order.id}</title>
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

        <div class="row"><span class="label">Store:</span> ${order.customerLabel || "-"}</div>
        <div class="row"><span class="label">Customer name:</span> ${order.customerName || "-"}</div>
        <div class="row"><span class="label">Bilagsnummer:</span> ${order.orderNumber || "-"}</div>
        <div class="row"><span class="label">Leveringsdato:</span> ${order.deliveryDate || "-"}</div>
        <div class="row"><span class="label">Tidsvindu:</span> ${order.timeWindow || "-"}</div>
        <div class="row"><span class="label">Telefon:</span> ${order.phone || "-"}</div>
        <div class="row"><span class="label">Henteadresse:</span> ${order.pickupAddress || "-"}</div>
        <div class="row"><span class="label">Ekstra hentesteder:</span> ${formatExtraPickup(order.extraPickupAddress)}</div>
        <div class="row"><span class="label">Leveringsadresse:</span> ${order.deliveryAddress || "-"}</div>
        <div class="row"><span class="label">Returadresse:</span> ${order.returnAddress || "-"}</div>
        <div class="row"><span class="label">Produkter:</span> ${order.productsSummary || "-"}</div>
        <div class="row"><span class="label">Leveringstype:</span> ${order.deliveryTypeSummary || "-"}</div>
        <div class="row"><span class="label">Montering / retur:</span> ${order.servicesSummary || "-"}</div>
        <div class="row"><span class="label">Beskrivelse:</span> ${order.description || "-"}</div>
        <div class="row"><span class="label">Kasserers navn:</span> ${order.cashierName || "-"}</div>
        <div class="row"><span class="label">Kasserers telefon:</span> ${order.cashierPhone || "-"}</div>
        <div class="row"><span class="label">Kundenotater:</span> ${order.customerComments || "-"}</div>
        <div class="row"><span class="label">Driver info:</span> ${order.driverInfo || "-"}</div>
        <div class="row"><span class="label">Status:</span> ${order.status || "-"}</div>
        <div class="row"><span class="label">Statusnotater:</span> ${order.statusNotes || "-"}</div>

        <div class="divider"></div>

        <div class="totals">
          <div class="total-row big">
            <span>Total</span><span>${totalExVat.toFixed(2)} NOK</span>
          </div>
          <div class="total-row">
            <span>MVA (25%)</span><span>${vat.toFixed(2)} NOK</span>
          </div>
          <div class="total-row">
            <span>Total inkl. MVA</span><span>${totalIncVat.toFixed(2)} NOK</span>
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

export default function ReadOnlyOrderModal({ open, order, onClose }: Props) {
  if (!open || !order) return null;

  const totalExVat = order.priceExVat ?? 0;
  const vat = totalExVat * 0.25;
  const totalIncVat = totalExVat + vat;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between">
          <h2 className="text-xl font-semibold">Ordredetaljer</h2>
          <button
            onClick={onClose}
            className="customButtonDefault h-8! w-8! rounded-full! px-0! py-0! text-sm"
          >
            X
          </button>
        </div>

        <div className="space-y-2 text-sm text-slate-800">
          <p>
            <span className="font-semibold">Store:</span>{" "}
            {formatCell(order.customerLabel)}
          </p>
          <p>
            <span className="font-semibold">Customer name:</span>{" "}
            {formatCell(order.customerName)}
          </p>
          <p>
            <span className="font-semibold">Bilagsnummer:</span>{" "}
            {formatCell(order.orderNumber)}
          </p>
          <p>
            <span className="font-semibold">Leveringsdato:</span>{" "}
            {formatCell(order.deliveryDate)}
          </p>
          <p>
            <span className="font-semibold">Tidsvindu:</span>{" "}
            {formatCell(order.timeWindow)}
          </p>
          <p>
            <span className="font-semibold">Telefon:</span>{" "}
            {formatCell(order.phone)}
          </p>
          <p>
            <span className="font-semibold">Henteadresse:</span>{" "}
            {formatCell(order.pickupAddress)}
          </p>
          <p>
            <span className="font-semibold">Ekstra hentesteder:</span>{" "}
            {formatExtraPickup(order.extraPickupAddress)}
          </p>
          <p>
            <span className="font-semibold">Leveringsadresse:</span>{" "}
            {formatCell(order.deliveryAddress)}
          </p>
          <p>
            <span className="font-semibold">Returadresse:</span>{" "}
            {formatCell(order.returnAddress)}
          </p>
          <p>
            <span className="font-semibold">Produkter:</span>{" "}
            {formatCell(order.productsSummary)}
          </p>
          <p>
            <span className="font-semibold">Leveringstype:</span>{" "}
            {formatCell(order.deliveryTypeSummary)}
          </p>
          <p>
            <span className="font-semibold">Montering / retur:</span>{" "}
            {formatCell(order.servicesSummary)}
          </p>
          <p>
            <span className="font-semibold">Beskrivelse:</span>{" "}
            {formatCell(order.description)}
          </p>
          <p>
            <span className="font-semibold">Kasserers navn:</span>{" "}
            {formatCell(order.cashierName)}
          </p>
          <p>
            <span className="font-semibold">Kasserers telefon:</span>{" "}
            {formatCell(order.cashierPhone)}
          </p>
          <p>
            <span className="font-semibold">Kundenotater:</span>{" "}
            {formatCell(order.customerComments)}
          </p>
          <p>
            <span className="font-semibold">Driver info:</span>{" "}
            {formatCell(order.driverInfo)}
          </p>
          <p>
            <span className="font-semibold">Status:</span>{" "}
            {formatCell(order.status)}
          </p>
          <p>
            <span className="font-semibold">Statusnotater:</span>{" "}
            {formatCell(order.statusNotes)}
          </p>
          <p>
            <span className="font-semibold">Opprettet av:</span>{" "}
            {formatCell(order.createdBy)}
          </p>
          <p>
            <span className="font-semibold">Sist redigert av:</span>{" "}
            {formatCell(order.lastEditedBy)}
          </p>
        </div>

        <div className="mt-4 space-y-1 rounded-xl bg-slate-50 p-4 text-sm">
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{totalExVat.toFixed(2)} NOK</span>
          </div>
          <div className="flex justify-between">
            <span>MVA (25%)</span>
            <span className="font-semibold">{vat.toFixed(2)} NOK</span>
          </div>
          <div className="flex justify-between">
            <span>Total inkl. MVA</span>
            <span className="font-semibold">{totalIncVat.toFixed(2)} NOK</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => downloadOrderPdf(order)}
            className="customButtonEnabled"
          >
            Last ned PDF
          </button>
        </div>
      </div>
    </div>
  );
}
