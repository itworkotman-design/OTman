"use client";

import { Fragment, useState } from "react";
import { createPortal } from "react-dom";
import { PinIcon } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import { buildOrderReviewBlocks } from "@/app/_components/site/BookingModal/whiteGoods/orderReview";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import { getVatBreakdown } from "@/lib/booking/pricing/vatDisplayTotal";
import type { WhiteGoodsBookingDetails } from "@/lib/orders/websiteBookingDetails";
import type { ProductGroup } from "@/lib/orders/websiteOrderProducts";

// What GET /api/orders/[orderId]/website-details returns.
export type WebsiteOrderView = {
  id: string;
  displayId: number;
  orderNumber: string | null;
  status: string | null;
  createdAt: string;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  customerComments: string | null;
  statusNotes: string | null;
  priceExVat: number;
  details: WhiteGoodsBookingDetails;
  products: ProductGroup[];
};

type Props = {
  order: WebsiteOrderView;
  onClose: () => void;
  // Swaps to the regular OrderModal/BookingEditor — the escape hatch for
  // anything this read-only view doesn't do.
  onOpenStandardEditor: () => void;
  canDelete?: boolean;
  onDeleted?: () => void;
  locale?: BookingUiLocale;
};

function formatKr(n: number) {
  return `${n.toLocaleString("nb-NO")} kr`;
}

// Read-only admin view of a homepage white-goods website order: every pickup
// stop, the delivery, the customer, and the itemized price — laid out like
// the customer's own summary page. Opened by DashboardOrderModal.
export default function WebsiteOrderModal({
  order,
  onClose,
  onOpenStandardEditor,
  canDelete = false,
  onDeleted,
  locale = "en",
}: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const { details } = order;
  const reviewBlocks = buildOrderReviewBlocks(locale === "nb" ? "no" : "en", {
    pickups: details.pickups,
    delivery: details.delivery,
    preferredDate: details.preferredDate,
    timeWindow: details.timeWindow,
    drivingDistance: details.drivingDistance,
    contact: {
      name: order.customerName ?? "",
      phone: order.phone ?? "",
      email: order.email ?? "",
      notes: order.customerComments ?? "",
    },
  });
  const vat = getVatBreakdown(order.priceExVat);
  const customerTypeLabel =
    details.customerType === "business"
      ? t("Business", "Bedrift")
      : details.customerType === "private"
        ? t("Private", "Privat")
        : null;

  async function handleDelete() {
    if (deleteLoading) return;
    if (!confirm(bookingText(locale, "Delete this order?"))) return;
    try {
      setDeleteLoading(true);
      setDeleteError("");
      const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setDeleteError(bookingText(locale, data?.reason || "Failed to delete order"));
        return;
      }
      onDeleted?.();
      onClose();
    } catch {
      setDeleteError(bookingText(locale, "Failed to delete order"));
    } finally {
      setDeleteLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center px-3 py-6 lg:px-6 lg:py-10">
        <div
          className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 rounded-t-2xl border-b bg-white px-6 py-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold text-logoblue">
                {t("Website order", "Nettsidebestilling")} {order.orderNumber ? `#${order.orderNumber}` : ""}
                <span className="ml-2 text-base font-normal text-black/40">({order.displayId})</span>
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-black/60">
                <span className="rounded-full bg-logoblue/10 px-2.5 py-0.5 font-semibold text-logoblue">
                  {t("Website order", "Nettside")}
                </span>
                {customerTypeLabel && (
                  <span className="rounded-full bg-black/5 px-2.5 py-0.5 font-medium">{customerTypeLabel}</span>
                )}
                {order.status && <span className="rounded-full bg-black/5 px-2.5 py-0.5 font-medium">{order.status}</span>}
                <span>
                  {t("Created", "Opprettet")} {new Date(order.createdAt).toLocaleString("nb-NO")}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-logoblue text-white"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
              <div className="flex flex-col gap-4">
                {reviewBlocks.map((block) => (
                  <div key={block.title} className="rounded-2xl border border-black/10 bg-white p-6">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-logoblue">
                      {block.kind === "location" && <PinIcon />}
                      {block.title}
                    </h3>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                      {block.rows.map((row) => (
                        <Fragment key={row.label}>
                          <dt className="text-black/50">{row.label}</dt>
                          <dd className="wrap-break-word whitespace-pre-line text-black/85">{row.value}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </div>
                ))}

                {order.statusNotes?.trim() && (
                  <div className="rounded-2xl border border-black/10 bg-white p-6">
                    <h3 className="text-base font-semibold text-logoblue">{t("Status notes", "Statusnotater")}</h3>
                    <p className="mt-3 whitespace-pre-line text-sm text-black/85">{order.statusNotes}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 lg:self-start">
                <div className="rounded-2xl border border-black/10 bg-white p-6">
                  <h3 className="text-lg font-semibold text-logoblue">{t("Products", "Varer")}</h3>
                  <p className="text-xs text-black/45">{t("Prices incl. VAT", "Priser inkl. mva")}</p>

                  {order.products.length === 0 ? (
                    <p className="mt-3 text-sm text-black/50">{t("No products.", "Ingen varer.")}</p>
                  ) : (
                    <div className="mt-4 flex flex-col gap-4">
                      {order.products.map((product) => (
                        <div key={product.cardId}>
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="font-semibold text-black/85">{product.productName}</p>
                            <p className="whitespace-nowrap font-semibold tabular-nums text-black/85">
                              {formatKr(product.total)}
                            </p>
                          </div>
                          {product.items.length > 0 && (
                            <div className="mt-2 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1.5 pl-1 text-sm">
                              {product.items.map((item, index) => (
                                <Fragment key={index}>
                                  <span className="flex items-center gap-2 text-black/60">
                                    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-logoblue" />
                                    {item.label}
                                  </span>
                                  <span className="justify-self-end whitespace-nowrap">
                                    {item.qty > 1 && (
                                      <span className="rounded-full bg-logoblue/10 px-1.5 py-0.5 text-xs font-semibold text-logoblue">
                                        {item.qty}×
                                      </span>
                                    )}
                                  </span>
                                  <span className="whitespace-nowrap text-right font-medium tabular-nums text-black/70">
                                    {formatKr(item.price)}
                                  </span>
                                </Fragment>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {details.orderExtras.length > 0 && (
                    <div className="mt-4 border-t border-black/10 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                        {t("Order extras", "Tillegg til ordren")}
                      </p>
                      <div className="mt-2 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1.5 pl-1 text-sm">
                        {details.orderExtras.map((line, index) => (
                          <Fragment key={index}>
                            <span className="flex items-center gap-2 text-black/60">
                              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-logoblue" />
                              {line.label}
                            </span>
                            <span className="justify-self-end whitespace-nowrap">
                              {line.qty > 1 && (
                                <span className="rounded-full bg-logoblue/10 px-1.5 py-0.5 text-xs font-semibold text-logoblue">
                                  {line.qty}×
                                </span>
                              )}
                            </span>
                            <span className="whitespace-nowrap text-right font-medium tabular-nums text-black/70">
                              {formatKr(line.price)}
                            </span>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-2 border-t border-black/10 pt-4 text-sm text-black/70">
                    <div className="flex justify-between">
                      <span>{t("Subtotal (ex. VAT)", "Delsum (eks. mva)")}</span>
                      <span className="tabular-nums">{formatKr(vat.exVat)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("VAT (25%)", "MVA (25%)")}</span>
                      <span className="tabular-nums">{formatKr(vat.vat)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-4 rounded-xl bg-logoblue/10 px-4 py-5">
                      <span className="text-base font-semibold text-logoblue">
                        {t("Total incl. VAT", "Totalt inkl. MVA")}
                      </span>
                      <span className="whitespace-nowrap text-3xl font-bold tabular-nums text-logoblue">
                        {formatKr(vat.incVat)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" onClick={onOpenStandardEditor} className="customButtonDefault h-10">
                {t("Open in standard editor", "Åpne i standard redigering")}
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="customButtonDefault h-10 bg-red-600! text-white! disabled:opacity-50!"
                >
                  {deleteLoading ? bookingText(locale, "Deleting...") : bookingText(locale, "Delete order")}
                </button>
              )}
            </div>
            {deleteError ? <div className="mt-2 text-sm font-medium text-red-600">{deleteError}</div> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
