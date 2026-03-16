"use client";

import type { OrderRow } from "@/lib/_mockdb";

type Props = {
  isOpen: boolean;
  order: OrderRow | null;
  onClose: () => void;
};

function downloadOrderPdf(order: OrderRow) {
  const content = `
    <html>
      <head>
        <title>Order ${order.orderNo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1 { font-size: 20px; margin-bottom: 20px; }
          .row { margin-bottom: 10px; }
          .label { font-weight: 700; }
          .section { margin-top: 20px; margin-bottom: 20px; }
          .line { border-top: 1px solid #ddd; margin: 16px 0; }
        </style>
      </head>
      <body>
        <h1>Ordredetaljer</h1>

        <div class="row"><span class="label">Henteadresse:</span> ${order.pickupAddress ?? "-"}</div>
        <div class="row"><span class="label">Ekstra hentesteder:</span> ${order.extraPickup ?? "-"}</div>
        <div class="row"><span class="label">Leveringsadresse:</span> ${order.deliveryAddress ?? "-"}</div>
        <div class="row"><span class="label">Leveringsdato:</span> ${order.deliveryDate ?? "-"}</div>
        <div class="row"><span class="label">Tidsvindu for Levering:</span> ${order.timeWindow ?? "-"}</div>
        <div class="row"><span class="label">Bilagsnummer:</span> ${order.orderNo ?? "-"}</div>
        <div class="row"><span class="label">Kasserers Navn:</span> ${order.cashierName ?? "-"}</div>
        <div class="row"><span class="label">Kasserers telefon:</span> ${order.cashierPhone ?? "-"}</div>
        <div class="row"><span class="label">Status:</span> ${order.status ?? "-"}</div>

        <div class="line"></div>

        <div class="row">${order.products ?? "-"}</div>
        <div class="row">${order.deliveryType ?? "-"}</div>
        <div class="row">${order.priceExVat ?? "0"} NOK</div>

        <div class="section">
          <div class="row"><span class="label">Total</span> ${order.priceExVat ?? "0.00"} NOK</div>
          <div class="row"><span class="label">Total inkl. MVA</span> ${order.priceIncVat ?? "0.00"} NOK</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
    </html>
  `;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.open();
  win.document.write(content);
  win.document.close();
}

export function SubcontractorOrderModal({ isOpen, order, onClose }: Props) {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between">
          <h2 className="text-xl font-semibold">Ordredetaljer</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm hover:bg-slate-100">
            Lukk
          </button>
        </div>

        <div className="space-y-3 text-sm text-slate-800">
          <p><span className="font-semibold">Henteadresse:</span> {order.pickupAddress ?? "-"}</p>
          <p><span className="font-semibold">Ekstra hentesteder:</span> {order.extraPickup ?? "-"}</p>
          <p><span className="font-semibold">Leveringsadresse:</span> {order.deliveryAddress ?? "-"}</p>
          <p><span className="font-semibold">Leveringsdato:</span> {order.deliveryDate ?? "-"}</p>
          <p><span className="font-semibold">Tidsvindu for Levering:</span> {order.timeWindow ?? "-"}</p>
          <p><span className="font-semibold">Bilagsnummer:</span> {order.orderNo ?? "-"}</p>
          <p><span className="font-semibold">Kasserers Navn:</span> {order.cashierName ?? "-"}</p>
          <p><span className="font-semibold">Kasserers telefon:</span> {order.cashierPhone ?? "-"}</p>
          <p><span className="font-semibold">Status:</span> {order.status ?? "-"}</p>

          <div className="my-4 border-t pt-4">
            <p>{order.products ?? "-"}</p>
            <p>{order.deliveryType ?? "-"}</p>
            <p>{order.priceExVat ?? "0"} NOK</p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p><span className="font-semibold">Total:</span> {order.priceExVat ?? "0.00"} NOK</p>
            <p><span className="font-semibold">Total inkl. MVA:</span> {order.priceIncVat ?? "0.00"} NOK</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => downloadOrderPdf(order)}
            className="rounded-xl bg-logoblue px-4 py-2 text-sm font-medium text-white"
          >
            Last ned PDF
          </button>
        </div>
      </div>
    </div>
  );
}