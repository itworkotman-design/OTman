"use client";

import { Fragment, useEffect, useState } from "react";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import type { MovingCatalogOption } from "@/lib/content/getMovingCatalog";
import type { MovingEdit } from "@/lib/orders/movingOrderEdit";
import type { PartnerPriceView, PartnerViewerRole } from "@/lib/orders/partnerOrderView";
import type { ServiceRequestItem } from "@/lib/orders/serviceBookingDetails";
import type { BookingCustomerType, WhiteGoodsBookingDetails } from "@/lib/orders/websiteBookingDetails";
import { buildMovingReviewBlocks } from "@/app/_components/site/BookingModal/moving/movingReview";
import { buildServiceReviewBlocks } from "@/app/_components/site/BookingModal/services/serviceReview";
import { buildOrderReviewBlocks, type ReviewBlock } from "@/app/_components/site/BookingModal/whiteGoods/orderReview";
import { OrderReviewBlocks } from "@/app/_components/site/BookingModal/whiteGoods/OrderReviewParts";

// What GET /api/orders/[orderId]/partner-view returns for a homepage website order.
type ViewBase = {
  role: PartnerViewerRole;
  displayId: number;
  orderNumber: string | null;
  status: string | null;
  contact: { name: string; phone: string; email: string; notes: string };
  description: string;
  driverInfo: string;
  partner: PartnerPriceView;
  customer: { totalExVat: number; totalIncVat: number } | null;
};
export type WebsitePartnerView =
  | (ViewBase & { kind: "white-goods"; details: WhiteGoodsBookingDetails })
  | (ViewBase & {
      kind: "moving";
      moving: { edit: MovingEdit; preferredDate: string; timeWindow: string; drivingDistance: string };
      sizeOptions: MovingCatalogOption[];
    })
  | (ViewBase & {
      kind: "service";
      // The services without staff's quotes — the partner's side is in `partner`.
      service: {
        customerType: BookingCustomerType | null;
        services: ServiceRequestItem[];
        address: string;
        preferredDate: string;
        timeWindow: string;
      };
    });

// The partner view for an order: "loading", the website view, or "other"
// (not a homepage website order — the modal keeps its old view).
export function useWebsitePartnerView(orderId: string | null) {
  const [state, setState] = useState<{ orderId: string | null; status: "loading" | "website" | "other"; view: WebsitePartnerView | null }>({
    orderId: null,
    status: "loading",
    view: null,
  });
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    fetch(`/api/orders/${orderId}/partner-view`, { credentials: "include", cache: "no-store" })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && data.view) setState({ orderId, status: "website", view: data.view });
        else setState({ orderId, status: "other", view: null });
      })
      .catch(() => !cancelled && setState({ orderId, status: "other", view: null }));
    return () => {
      cancelled = true;
    };
  }, [orderId]);
  // A previous order's answer never stands for this one.
  return state.orderId === orderId ? state : { orderId, status: "loading" as const, view: null };
}

function kr(n: number) {
  return `${n.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} kr`;
}

export function websitePartnerReviewBlocks(view: WebsitePartnerView, locale: BookingUiLocale): ReviewBlock[] {
  const siteLocale = locale === "nb" ? "no" : "en";
  // The partner sees the customer's contact (they meet them on the job).
  if (view.kind === "service") return buildServiceReviewBlocks(siteLocale, { ...view.service, contact: view.contact });
  return view.kind === "moving"
    ? buildMovingReviewBlocks(siteLocale, {
        pickupAddress: view.moving.edit.pickupAddress,
        deliveryAddress: view.moving.edit.deliveryAddress,
        origin: view.moving.edit.origin,
        destination: view.moving.edit.destination,
        sizeOptions: view.sizeOptions,
        preferredDate: view.moving.preferredDate,
        timeWindow: view.moving.timeWindow,
        drivingDistance: view.moving.drivingDistance,
        contact: view.contact,
      })
    : buildOrderReviewBlocks(siteLocale, {
        pickups: view.details.pickups,
        delivery: view.details.delivery,
        preferredDate: view.details.preferredDate,
        timeWindow: view.details.timeWindow,
        drivingDistance: view.details.drivingDistance,
        contact: view.contact,
      });
}

// The job as booked (the same cards as the admin modal and the customer's
// summary), the internal description / driver info, and the partner's price.
export default function WebsitePartnerOrderView({ view, locale }: { view: WebsitePartnerView; locale: BookingUiLocale }) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const blocks = websitePartnerReviewBlocks(view, locale);
  const notes = [
    [t("Description", "Beskrivelse"), view.description],
    [t("Info for the driver", "Info til sjåføren"), view.driverInfo],
  ].filter(([, value]) => value.trim());

  return (
    <div className="grid max-h-[72vh] gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* All the order's details in one card, sections split by a line (as in the admin modal). */}
      <div className="divide-y divide-black/10 self-start rounded-2xl border border-black/10 bg-white">
        <OrderReviewBlocks blocks={blocks} bare />
        {notes.length > 0 && (
          <div className="p-6">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {notes.map(([label, value]) => (
                <Fragment key={label}>
                  <dt className="text-black/50">{label}</dt>
                  <dd className="whitespace-pre-line text-black/85">{value}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:self-start">
        <div className="rounded-2xl border border-black/10 bg-white p-6">
          <h3 className="text-lg font-semibold text-logoblue">{t("Partner price", "Partnerpris")}</h3>
          <p className="text-xs text-black/45">{t("Ex. VAT", "Eks. mva")}</p>
          {view.partner.groups.map((group) => (
            <div key={group.name} className="mt-4">
              <p className="font-semibold text-black/85">{group.name}</p>
              <div className="mt-2 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1.5 pl-1 text-sm">
                {group.lines.map((line, index) => (
                  <Fragment key={index}>
                    <span className="text-black/60">{line.label}</span>
                    <span className="justify-self-end">
                      {line.qty > 1 && (
                        <span className="rounded-full bg-logoblue/10 px-1.5 py-0.5 text-xs font-semibold text-logoblue">{line.qty}×</span>
                      )}
                    </span>
                    <span className="text-right font-medium tabular-nums text-black/70">{kr(line.price)}</span>
                  </Fragment>
                ))}
              </div>
            </div>
          ))}
          {view.partner.mismatch !== 0 && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {view.partner.groups.length === 0
                ? t("The lines couldn't be shown — the total is what's stored on the order.", "Linjene kunne ikke vises — totalen er det som er lagret på ordren.")
                : t(
                    `The lines don't add up to the stored price (${kr(view.partner.mismatch)} difference) — ask the office.`,
                    `Linjene stemmer ikke med den lagrede prisen (${kr(view.partner.mismatch)} i differanse) — spør kontoret.`,
                  )}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-logoblue/10 px-4 py-4">
            <span className="text-base font-semibold text-logoblue">{t("Total", "Totalt")}</span>
            <span className="text-2xl font-bold tabular-nums text-logoblue">{kr(view.partner.total)}</span>
          </div>
        </div>

        {view.customer && (
          <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm">
            <h3 className="mb-2 text-lg font-semibold text-logoblue">{t("Customer price", "Kundepris")}</h3>
            <div className="flex justify-between">
              <span className="text-black/60">{t("Ex. VAT", "Eks. mva")}</span>
              <span className="tabular-nums">{kr(view.customer.totalExVat)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>{t("Incl. VAT", "Inkl. mva")}</span>
              <span className="tabular-nums">{kr(view.customer.totalIncVat)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// The same view as a printable page (the modal's "Last ned PDF").
export function downloadWebsitePartnerPdf(view: WebsitePartnerView, locale: BookingUiLocale) {
  const blocks = websitePartnerReviewBlocks(view, locale);
  const blocksHtml = blocks
    .map(
      (block) => `
        <h2>${escapeHtml(block.title)}</h2>
        <table>${block.rows.map((row) => `<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`).join("")}</table>`,
    )
    .join("");
  const linesHtml = view.partner.groups
    .map(
      (group) => `
        <h3>${escapeHtml(group.name)}</h3>
        ${group.lines
          .map((line) => `<div class="row"><span>${line.qty > 1 ? `x${line.qty} ` : ""}${escapeHtml(line.label)}</span><strong>${escapeHtml(kr(line.price))}</strong></div>`)
          .join("")}`,
    )
    .join("");
  const html = `
    <html>
      <head>
        <title>Ordre ${escapeHtml(view.orderNumber ?? view.displayId)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #111; font-size: 12px; }
          .layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 18px; align-items: start; }
          h1 { font-size: 20px; margin: 0 0 14px; } h2 { font-size: 14px; margin: 14px 0 6px; } h3 { font-size: 13px; margin: 10px 0 4px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #d8dee8; padding: 6px 8px; text-align: left; vertical-align: top; }
          th { width: 150px; background: #f8fafc; }
          .card { border: 1px solid #d8dee8; border-radius: 12px; padding: 12px; }
          .row { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e5e7eb; padding: 3px 0; }
          .total { font-size: 15px; font-weight: 700; margin-top: 10px; }
        </style>
        <script>window.onload = function() { window.print(); }</script>
      </head>
      <body>
        <h1>Ordre ${escapeHtml(view.orderNumber ?? "")} (${escapeHtml(view.displayId)})</h1>
        <div class="layout">
          <div>${blocksHtml}</div>
          <div class="card">
            <h2>Partnerpris (eks. mva)</h2>
            ${linesHtml}
            <div class="row total"><span>Totalt</span><strong>${escapeHtml(kr(view.partner.total))}</strong></div>
          </div>
        </div>
      </body>
    </html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
