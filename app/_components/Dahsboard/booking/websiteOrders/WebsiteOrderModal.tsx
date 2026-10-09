"use client";

import { Fragment, useState } from "react";
import { createPortal } from "react-dom";
import { PinIcon } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import { buildOrderReviewBlocks } from "@/app/_components/site/BookingModal/whiteGoods/orderReview";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import { getVatBreakdown } from "@/lib/booking/pricing/vatDisplayTotal";
import type { WhiteGoodsBookingDetails } from "@/lib/orders/websiteBookingDetails";
import type { ProductGroup } from "@/lib/orders/websiteOrderProducts";
import WebsiteOrderAdminActions from "./WebsiteOrderAdminActions";
import { WhiteGoodsBookingFlow } from "@/app/_components/site/BookingModal/whiteGoods/WhiteGoodsBookingFlow";
import WebsiteOrderPaymentSummary from "./WebsiteOrderPaymentSummary";
import type { OrderPaymentComparison } from "@/lib/orders/paidOrderSnapshot";
import type { WebsiteOrderHandling } from "@/lib/orders/websiteOrderHandling";
import WebsiteOrderAttachments from "./WebsiteOrderAttachments";
import WebsiteOrderCustomerLoginButton from "./WebsiteOrderCustomerLoginButton";
import WebsiteOrderCalculator from "./WebsiteOrderCalculator";
import type { WebsiteOrderCalculatorView, WebsiteOrderPricingDraft } from "@/lib/orders/websiteOrderCalculator";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

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
  // Lines vs total vs what the customer was shown (checkWebsiteOrderTotals).
  totalsCheck: {
    linesTotal: number;
    missingFromLines: number;
    shownTotal: number | null;
    differsFromShown: number;
  };
  subcontractorMembershipId: string | null;
  subcontractor: string | null;
  gsmSentAt: string | null;
  gsmSyncStatus: string | null;
  // The customer already has a live "My order" login for this email.
  hasCustomerLogin: boolean;
  // Paid so far vs. the order now (compareOrderWithPayments).
  payment: OrderPaymentComparison;
  // Fields only an admin handles (driver, deviation, discount…).
  handling: WebsiteOrderHandling;
  // Customer and partner price per line (null when the order can't be priced).
  calculator: WebsiteOrderCalculatorView | null;
};

type Props = {
  order: WebsiteOrderView;
  onClose: () => void;
  // After a status/partner save or GSM send — reload the order (and list).
  onChanged: () => void;
  canDelete?: boolean;
  onDeleted?: () => void;
  locale?: BookingUiLocale;
};

// Nothing is changed from the modal once an order is done or dead (same rule
// as PUT /api/orders/[orderId]/website-items).
const LOCKED_STATUSES = new Set(["cancelled", "completed", "invoiced", "paid"]);

function formatKr(n: number) {
  return `${n.toLocaleString("nb-NO")} kr`;
}

// Read-only admin view of a homepage white-goods website order: every pickup
// stop, the delivery, the customer, and the itemized price — laid out like
// the customer's own summary page. Opened by DashboardOrderModal.
export default function WebsiteOrderModal({
  order,
  onClose,
  onChanged,
  canDelete = false,
  onDeleted,
  locale = "en",
}: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [editingOrder, setEditingOrder] = useState(false);
  const [editNotice, setEditNotice] = useState("");
  // The calculator's unsaved changes; the one Save under "Handle order" stores them.
  const [pricingDraft, setPricingDraft] = useState<WebsiteOrderPricingDraft | null>(null);
  // Above the left column's Save: where the calculator shows its price preview.
  const [priceChangeSlot, setPriceChangeSlot] = useState<HTMLDivElement | null>(null);
  const check = order.totalsCheck;
  const totalsWarnings = [
    check.differsFromShown !== 0 && check.shownTotal !== null
      ? t(
          `The customer was shown ${formatKr(check.shownTotal)} when booking, but the order total is ${formatKr(order.priceExVat)} (${check.differsFromShown > 0 ? "+" : ""}${formatKr(check.differsFromShown)}).`,
          `Kunden så ${formatKr(check.shownTotal)} ved bestilling, men ordretotalen er ${formatKr(order.priceExVat)} (${check.differsFromShown > 0 ? "+" : ""}${formatKr(check.differsFromShown)}).`,
        )
      : null,
    check.missingFromLines !== 0
      ? t(
          `The order lines add up to ${formatKr(check.linesTotal)}, but the order total is ${formatKr(order.priceExVat)} — ${formatKr(Math.abs(check.missingFromLines))} is ${check.missingFromLines > 0 ? "not on any line" : "on lines but not in the total"}. Prices may be missing or wrong.`,
          `Ordrelinjene blir ${formatKr(check.linesTotal)}, men ordretotalen er ${formatKr(order.priceExVat)} — ${formatKr(Math.abs(check.missingFromLines))} ${check.missingFromLines > 0 ? "står ikke på noen linje" : "står på linjer men ikke i totalen"}. Priser kan mangle eller være feil.`,
        )
      : null,
  ].filter((warning): warning is string => warning !== null);
  const canEditOrder = !LOCKED_STATUSES.has(normalizeOrderStatus(order.status));

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
  // The calculator's four fields; "Handle order" saves everything else.
  const { rabatt, leggTil, subcontractorMinus, subcontractorPlus, ...panelHandling } = order.handling;
  const calculatorAdjustments = { rabatt, leggTil, subcontractorMinus, subcontractorPlus };
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
            <div className="flex shrink-0 items-center gap-2">
              {!order.hasCustomerLogin && (
                <WebsiteOrderCustomerLoginButton orderId={order.id} email={order.email} t={t} onResult={setEditNotice} />
              )}
              {canEditOrder && !editingOrder && (
                <button
                  type="button"
                  onClick={() => {
                    // Saving the edit reloads the order, which would silently
                    // drop unsaved calculator changes (discount, extra, lines
                    // set to 0) — make that a choice.
                    if (
                      pricingDraft &&
                      !window.confirm(
                        t(
                          "You have unsaved price changes in the calculator. They will be lost if you edit the order now. Continue?",
                          "Du har ulagrede prisendringer i kalkulatoren. De går tapt hvis du endrer bestillingen nå. Fortsette?",
                        ),
                      )
                    ) {
                      return;
                    }
                    setEditNotice("");
                    setEditingOrder(true);
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-logoblue px-4 text-sm font-semibold text-logoblue"
                >
                  {t("Edit order", "Endre bestilling")}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-logoblue text-white"
              >
                ×
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
            {totalsWarnings.length > 0 && (
              <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
                <p className="font-bold">{t("Price problem on this order — check before taking payment", "Prisproblem på denne ordren — sjekk før betaling")}</p>
                <ul className="mt-1 list-disc pl-5">
                  {totalsWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            {editNotice && (
              <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{editNotice}</p>
            )}
            {/* "Edit order" opens the customer's own booking modal on top,
                prefilled, with every section open (see WhiteGoodsBookingFlow's
                `admin`). */}
            {editingOrder && (
              <WhiteGoodsBookingFlow
                locale={locale === "nb" ? "no" : "en"}
                onClose={() => setEditingOrder(false)}
                admin={{
                  orderId: order.id,
                  orderLabel: order.orderNumber ? `#${order.orderNumber}` : `(${order.displayId})`,
                  gsmSentAt: order.gsmSentAt,
                  onSaved: (message) => {
                    setEditingOrder(false);
                    setEditNotice(message);
                    onChanged();
                  },
                }}
              />
            )}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
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

                <WebsiteOrderAdminActions
                  key={`${order.status}|${order.statusNotes}|${order.subcontractorMembershipId}|${JSON.stringify(panelHandling)}`}
                  order={order}
                  locale={locale}
                  onChanged={onChanged}
                  pricingDraft={pricingDraft}
                  priceChangeSlotRef={setPriceChangeSlot}
                  besideSave={
                    canDelete ? (
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleteLoading}
                        className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-red-600 px-5 text-base font-semibold text-white disabled:opacity-50"
                      >
                        {deleteLoading ? bookingText(locale, "Deleting...") : bookingText(locale, "Delete order")}
                      </button>
                    ) : null
                  }
                >
                  <WebsiteOrderAttachments orderId={order.id} locale={locale} />
                </WebsiteOrderAdminActions>
                {deleteError ? <p className="text-center text-sm font-medium text-red-600">{deleteError}</p> : null}
              </div>

              {/* Right column: only what the order costs — payment and products. */}
              <div className="flex flex-col gap-4 lg:self-start">
                <div className="rounded-2xl border border-black/10 bg-white p-6">
                  <h3 className="mb-3 text-lg font-semibold text-logoblue">{t("Payment", "Betaling")}</h3>
                  <WebsiteOrderPaymentSummary comparison={order.payment} locale={locale} />
                </div>
                {order.calculator ? (
                  <WebsiteOrderCalculator
                    key={`${order.priceExVat}|${JSON.stringify(order.calculator)}|${JSON.stringify(calculatorAdjustments)}`}
                    orderId={order.id}
                    calculator={order.calculator}
                    adjustments={calculatorAdjustments}
                    missingFromLines={order.totalsCheck.missingFromLines}
                    storedTotal={order.priceExVat}
                    locale={locale}
                    onChanged={onChanged}
                    onDraftChange={setPricingDraft}
                    priceChangeTarget={priceChangeSlot}
                  />
                ) : (
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

                  {order.totalsCheck.missingFromLines !== 0 && (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                      <span>{t("Not covered by the lines above", "Ikke dekket av linjene over")}</span>
                      <span className="whitespace-nowrap font-semibold tabular-nums">
                        {order.totalsCheck.missingFromLines > 0 ? "+" : ""}
                        {formatKr(order.totalsCheck.missingFromLines)}
                      </span>
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
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
