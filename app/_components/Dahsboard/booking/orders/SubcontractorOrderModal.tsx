"use client";

import { PRICE_ITEMS_DEFAULT } from "@/lib/prices_default/pricingDefault";
import { PRODUCTS_DEFAULT } from "@/lib/prices_default/productsDefault";
import type { OrderRow } from "@/lib/_mockdb";
import type { LineItem } from "@/app/_components/Dahsboard/booking/create/ProductCard";

type Props = {
  isOpen: boolean;
  order: OrderRow | null;
  onClose: () => void;
};

// ─── shared helper ────────────────────────────────────────────────────────────

type BreakdownLine = {
  label: string;
  code: string;
  qty: number;
  lineTotal: number;
};

type ProductBreakdown = {
  productName: string;
  lines: BreakdownLine[];
};

function buildBreakdowns(order: OrderRow): ProductBreakdown[] {
  const cardIds = Object.keys(order.cardItems).map(Number);

  return cardIds
    .map((cardId) => {
      const productId = order.cardProducts?.[cardId] ?? null;
      const productName = productId
        ? PRODUCTS_DEFAULT.find((p) => p.id === productId)?.label ?? productId
        : order.products?.[cardId] ?? "Unknown product";

      const rawItems: LineItem[] = order.cardItems[cardId] ?? [];

      // group duplicate keys
      const grouped = new Map<string, { qty: number; priceOverride?: number }>();
      for (const it of rawItems) {
        const existing = grouped.get(it.key);
        grouped.set(it.key, {
          qty: (existing?.qty ?? 0) + it.qty,
          priceOverride:
            it.priceOverride !== undefined ? it.priceOverride : existing?.priceOverride,
        });
      }

      const lines: BreakdownLine[] = Array.from(grouped.entries())
        .map(([key, { qty, priceOverride }]) => {
          const item = PRICE_ITEMS_DEFAULT.find((i) => i.key === key);
          if (!item) return null;
          const price = priceOverride !== undefined ? priceOverride : item.customerPrice;
          return { label: item.label, code: item.code, qty, lineTotal: price * qty };
        })
        .filter((x): x is BreakdownLine => x !== null);

      return { productName, lines };
    })
    .filter((b) => b.lines.length > 0);
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

function downloadOrderPdf(order: OrderRow) {
  const breakdowns = buildBreakdowns(order);
  const totalExVat = order.priceExVat ?? 0;
  const vat = totalExVat * 0.25;
  const totalIncVat = order.priceIncVat ?? totalExVat + vat;

  const productsHtml = breakdowns
    .map(
      ({ productName, lines }) => `
        <div class="product-block">
          <h2 class="product-name">${productName}</h2>
          ${lines
            .map(
              ({ label, code, qty, lineTotal }) => `
            <div class="price-row">
              <span>${qty > 1 ? `<span class="qty">x${qty}</span> ` : ""}${label} <span class="code">(${code})</span></span>
              <span class="amount">${lineTotal} NOK</span>
            </div>`
            )
            .join("")}
        </div>`
    )
    .join("");

  const content = `
    <html>
      <head>
        <title>Ordre ${order.orderNo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; font-size: 14px; }
          h1 { font-size: 20px; margin-bottom: 20px; }
          h2.product-name { font-size: 15px; font-weight: 700; margin: 16px 0 6px; }
          .row { margin-bottom: 8px; }
          .label { font-weight: 700; }
          .divider { border-top: 1px solid #ddd; margin: 16px 0; }
          .product-block { margin-bottom: 12px; }
          .price-row { display: flex; justify-content: space-between; margin-bottom: 4px; padding-left: 8px; font-size: 13px; }
          .qty { opacity: 0.6; }
          .code { color: #2563eb; }
          .amount { font-weight: 600; white-space: nowrap; }
          .totals { margin-top: 16px; background: #f8fafc; border-radius: 8px; padding: 12px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .total-row.big { font-size: 18px; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>Ordredetaljer</h1>

        <div class="row"><span class="label">Henteadresse:</span> ${order.pickupAddress ?? "-"}</div>
        <div class="row"><span class="label">Ekstra hentesteder:</span> ${order.extraPickup ?? "-"}</div>
        <div class="row"><span class="label">Leveringsadresse:</span> ${order.deliveryAddress ?? "-"}</div>
        <div class="row"><span class="label">Leveringsdato:</span> ${order.deliveryDate ?? "-"}</div>
        <div class="row"><span class="label">Tidsvindu:</span> ${order.timeWindow ?? "-"}</div>
        <div class="row"><span class="label">Bilagsnummer:</span> ${order.orderNo ?? "-"}</div>
        <div class="row"><span class="label">Kasserers navn:</span> ${order.cashierName ?? "-"}</div>
        <div class="row"><span class="label">Kasserers telefon:</span> ${order.cashierPhone ?? "-"}</div>
        <div class="row"><span class="label">Status:</span> ${order.status ?? "-"}</div>

        <div class="divider"></div>

        ${productsHtml}

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

// ─── Modal ────────────────────────────────────────────────────────────────────

export function SubcontractorOrderModal({ isOpen, order, onClose }: Props) {
  if (!isOpen || !order) return null;

  const breakdowns = buildBreakdowns(order);
  const totalExVat = order.priceExVat ?? 0;
  const vat = totalExVat * 0.25;
  const totalIncVat = order.priceIncVat ?? totalExVat + vat;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <h2 className="text-xl font-semibold">Ordredetaljer</h2>
          <button onClick={onClose} className="border rounded-full! h-8! w-8! px-0! py-0! text-sm customButtonDefault">
            X
          </button>
        </div>

        {/* Order info */}
        <div className="space-y-2 text-sm text-slate-800">
          <p><span className="font-semibold">Henteadresse:</span> {order.pickupAddress ?? "-"}</p>
          <p><span className="font-semibold">Ekstra hentesteder:</span> {order.extraPickup ?? "-"}</p>
          <p><span className="font-semibold">Leveringsadresse:</span> {order.deliveryAddress ?? "-"}</p>
          <p><span className="font-semibold">Leveringsdato:</span> {order.deliveryDate ?? "-"}</p>
          <p><span className="font-semibold">Tidsvindu:</span> {order.timeWindow ?? "-"}</p>
          <p><span className="font-semibold">Bilagsnummer:</span> {order.orderNo ?? "-"}</p>
          <p><span className="font-semibold">Kasserers navn:</span> {order.cashierName ?? "-"}</p>
          <p><span className="font-semibold">Kasserers telefon:</span> {order.cashierPhone ?? "-"}</p>
          <p><span className="font-semibold">Status:</span> {order.status ?? "-"}</p>
        </div>

        {/* Product breakdowns */}
        <div className="mt-4 border-t pt-4 space-y-4">
          {breakdowns.length === 0 ? (
            <p className="text-sm opacity-40">No products.</p>
          ) : (
            breakdowns.map(({ productName, lines }, i) => (
              <div key={i}>
                <h3 className="font-bold text-sm mb-2">{productName}</h3>
                {lines.map(({ label, code, qty, lineTotal }) => (
                  <div key={label} className="flex justify-between text-sm pl-2 mb-1">
                    <span>
                      {qty > 1 && <span className="opacity-60 mr-1">x{qty}</span>}
                      {label} <span className="text-logoblue">({code})</span>
                    </span>
                    <span className="font-semibold whitespace-nowrap">{lineTotal} NOK</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Totals */}
        <div className="mt-4 rounded-xl bg-slate-50 p-4 space-y-1 text-sm">
          <div className="flex justify-between font-bold text-lg">
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

        {/* Actions */}
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