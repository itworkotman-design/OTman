"use client";

import type { PriceChangeRow } from "@/lib/booking/pricing/priceChanges";
import { Fragment, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { buildOrderReviewBlocks } from "@/app/_components/site/BookingModal/whiteGoods/orderReview";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import type { BookingCustomerType, OrderExtraLine, WhiteGoodsBookingDetails } from "@/lib/orders/websiteBookingDetails";
import type { MovingCatalogOption } from "@/lib/content/getMovingCatalog";
import type { MovingEdit } from "@/lib/orders/movingOrderEdit";
import { buildMovingReviewBlocks } from "@/app/_components/site/BookingModal/moving/movingReview";
import { OrderReviewBlocks } from "@/app/_components/site/BookingModal/whiteGoods/OrderReviewParts";
import MovingOrderEditTab from "./MovingOrderEditTab";
import type { ProductGroup } from "@/lib/orders/websiteOrderProducts";
import WebsiteOrderAdminActions from "./WebsiteOrderAdminActions";
import WebsiteOrderEditTab from "./WebsiteOrderEditTab";
import WebsiteOrderPaymentSummary from "./WebsiteOrderPaymentSummary";
import type { OrderPaymentComparison } from "@/lib/orders/paidOrderSnapshot";
import type { WebsiteOrderHandling } from "@/lib/orders/websiteOrderHandling";
import WebsiteOrderAttachments from "./WebsiteOrderAttachments";
import { EMPTY_ATTACHMENT_DRAFT, hasAttachmentChanges, type AttachmentDraft } from "@/lib/orders/attachmentDraft";
import WebsiteOrderCustomerLoginButton from "./WebsiteOrderCustomerLoginButton";
import WebsiteOrderCalculator from "./WebsiteOrderCalculator";
import type { WebsiteOrderCalculatorView, WebsiteOrderPricingDraft } from "@/lib/orders/websiteOrderCalculator";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

// What GET /api/orders/[orderId]/website-details returns — the same for every
// website order…
type WebsiteOrderBase = {
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
};

// …plus, for a homepage move, its answers and its lines read from the order
// (edited in MovingOrderEditTab), with the same calculator as a delivery.
export type MovingWebsiteOrderView = WebsiteOrderBase & {
  kind: "moving";
  moving: {
    edit: MovingEdit;
    customerType: BookingCustomerType | null;
    preferredDate: string;
    timeWindow: string;
    drivingDistance: string;
  };
  sizeOptions: MovingCatalogOption[];
  orderExtras: OrderExtraLine[];
  // Customer and partner price per line (the partner side null for who may not see it).
  calculator: WebsiteOrderCalculatorView;
  // The move's answers at today's prices — "Use new price" when priceChanges lists any.
  currentPricesTotal?: number | null;
  priceChanges?: PriceChangeRow[];
};

export type WebsiteOrderView = MovingWebsiteOrderView | WhiteGoodsWebsiteOrderView;

// …or, for a white-goods (delivery) order, its stops and the calculator.
export type WhiteGoodsWebsiteOrderView = WebsiteOrderBase & {
  kind?: undefined;
  details: WhiteGoodsBookingDetails;
  // Customer and partner price per line (null when the order can't be priced).
  calculator: WebsiteOrderCalculatorView | null;
  // The customer total at today's catalog prices — "Use new price" when it differs.
  currentPricesTotal?: number | null;
  // What "Use new price" would change, line by line.
  priceChanges?: PriceChangeRow[];
  // Products whose saved prices lack their delivery type or an option.
  savedPricesIncomplete?: string[];
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


// Admin view of a homepage website order — a white-goods delivery (every
// pickup stop, the delivery, the calculator) or a move (both ends, timing,
// its priced lines and the partner's side) — with the customer, laid out like
// the customer's own summary page, and an "Edit order" tab for each kind
// (WebsiteOrderEditTab / MovingOrderEditTab). Opened by DashboardOrderModal.
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
  // "Overview" (the order, its handling and the calculator) or "Edit order"
  // (products, pickups, delivery and customer — WebsiteOrderEditTab).
  const [tab, setTab] = useState<"overview" | "edit">("overview");
  const [editDirty, setEditDirty] = useState(false);
  const handleEditDirtyChange = useCallback((dirty: boolean) => setEditDirty(dirty), []);
  const [editNotice, setEditNotice] = useState("");
  // The calculator's unsaved changes; the one Save under "Handle order" stores them.
  const [pricingDraft, setPricingDraft] = useState<WebsiteOrderPricingDraft | null>(null);
  // Picked/removed attachments — stored by the Overview's Save, never before.
  const [attachmentDraft, setAttachmentDraft] = useState<AttachmentDraft>(EMPTY_ATTACHMENT_DRAFT);
  // Bumped after that Save so the attachment list reloads what was stored.
  const [attachmentsVersion, setAttachmentsVersion] = useState(0);
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

  const contact = {
    name: order.customerName ?? "",
    phone: order.phone ?? "",
    email: order.email ?? "",
    notes: order.customerComments ?? "",
  };
  const siteLocale = locale === "nb" ? "no" : "en";
  // The answers as cards — a move's two ends and timing, or a delivery's stops.
  const reviewBlocks =
    order.kind === "moving"
      ? buildMovingReviewBlocks(siteLocale, {
          pickupAddress: order.moving.edit.pickupAddress,
          deliveryAddress: order.moving.edit.deliveryAddress,
          origin: order.moving.edit.origin,
          destination: order.moving.edit.destination,
          sizeOptions: order.sizeOptions,
          preferredDate: order.moving.preferredDate,
          timeWindow: order.moving.timeWindow,
          drivingDistance: order.moving.drivingDistance,
          contact,
        })
      : buildOrderReviewBlocks(siteLocale, {
          pickups: order.details.pickups,
          delivery: order.details.delivery,
          preferredDate: order.details.preferredDate,
          timeWindow: order.details.timeWindow,
          drivingDistance: order.details.drivingDistance,
          contact,
        });
  const orderExtras = order.kind === "moving" ? order.orderExtras : order.details.orderExtras;
  const customerType = order.kind === "moving" ? order.moving.customerType : order.details.customerType;
  // Stored ex. VAT; what the customer pays (incl. VAT, summed per line) is the
  // payment comparison's current total.
  const vat = {
    exVat: order.priceExVat,
    incVat: order.payment.currentTotalIncVatNok,
    vat: Math.round((order.payment.currentTotalIncVatNok - order.priceExVat) * 100) / 100,
  };
  // The calculator's four fields; "Handle order" saves everything else.
  const { rabatt, leggTil, subcontractorMinus, subcontractorPlus, ...panelHandling } = order.handling;
  const calculatorAdjustments = { rabatt, leggTil, subcontractorMinus, subcontractorPlus };
  const customerTypeLabel =
    customerType === "business"
      ? t("Business", "Bedrift")
      : customerType === "private"
        ? t("Private", "Privat")
        : null;

  function confirmDiscardEdits() {
    return window.confirm(t("Discard your unsaved changes to the order?", "Forkaste ulagrede endringer i bestillingen?"));
  }

  function switchTab(next: "overview" | "edit") {
    if (next === tab) return;
    // Leaving Overview with unsaved calculator changes, or Edit with unsaved
    // edits, would silently drop them — make that a choice.
    if (
      next === "edit" &&
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
    if (next === "overview" && editDirty && !confirmDiscardEdits()) return;
    if (next === "edit") {
      setPricingDraft(null);
      setEditNotice("");
    }
    setEditDirty(false);
    setTab(next);
  }

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

  // Left of Save on both tabs (Overview and Edit order).
  const deleteButton = canDelete ? (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleteLoading}
      className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-red-600 px-5 text-base font-semibold text-white disabled:opacity-50"
    >
      {deleteLoading ? bookingText(locale, "Deleting...") : bookingText(locale, "Delete order")}
    </button>
  ) : null;

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
              <button
                type="button"
                onClick={() => {
                  const unsaved = editDirty || !!pricingDraft || hasAttachmentChanges(attachmentDraft);
                  if (unsaved && !confirmDiscardEdits()) return;
                  onClose();
                }}
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-logoblue text-white"
              >
                ×
              </button>
            </div>
          </div>

          {canEditOrder && (
            <div className="flex shrink-0 gap-1 border-b bg-white px-6">
              {(
                [
                  ["overview", t("Overview", "Oversikt")],
                  ["edit", t("Edit order", "Endre bestilling")],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchTab(key)}
                  className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                    tab === key ? "border-logoblue text-logoblue" : "border-transparent text-black/50 hover:text-black/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

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
            {tab === "edit" && deleteError && (
              <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{deleteError}</p>
            )}
            {tab === "edit" && order.kind === "moving" ? (
              <MovingOrderEditTab
                orderId={order.id}
                locale={locale}
                initial={{
                  edit: order.moving.edit,
                  customer: { name: contact.name, phone: contact.phone, email: contact.email, comments: contact.notes },
                  customerType: order.moving.customerType,
                  schedule: { preferredDate: order.moving.preferredDate, timeWindow: order.moving.timeWindow },
                }}
                calculator={order.calculator}
                adjustments={calculatorAdjustments}
                storedTotal={order.priceExVat}
                currentPricesTotal={order.currentPricesTotal ?? null}
                priceChanges={order.priceChanges ?? []}
                onDirtyChange={handleEditDirtyChange}
                onCancel={() => switchTab("overview")}
                besideSave={deleteButton}
                onSaved={(message) => {
                  setEditDirty(false);
                  setTab("overview");
                  setEditNotice(message);
                  onChanged();
                }}
              />
            ) : tab === "edit" && order.kind !== "moving" ? (
              <WebsiteOrderEditTab
                orderId={order.id}
                locale={locale}
                onDirtyChange={handleEditDirtyChange}
                onCancel={() => switchTab("overview")}
                besideSave={deleteButton}
                storedTotal={order.priceExVat}
                currentPricesTotal={order.currentPricesTotal ?? null}
                priceChanges={order.priceChanges ?? []}
                savedPricesIncomplete={order.savedPricesIncomplete ?? []}
                onSaved={(message) => {
                  setEditDirty(false);
                  setTab("overview");
                  setEditNotice(message);
                  onChanged();
                }}
              />
            ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
              <div className="flex flex-col gap-4">
                <OrderReviewBlocks blocks={reviewBlocks} />

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
                  attachmentDraft={attachmentDraft}
                  onAttachmentsApplied={(remaining) => {
                    // Only failed file changes stay pending; the list reloads what was stored.
                    setAttachmentDraft(remaining);
                    setAttachmentsVersion((version) => version + 1);
                  }}
                  priceChangeSlotRef={setPriceChangeSlot}
                  besideSave={deleteButton}
                  // A move saves its handling through its own route, without the white-goods price fields.
                  {...(order.kind === "moving"
                    ? { handlingEndpoint: `/api/orders/${order.id}/moving-details`, priceFields: false }
                    : {})}
                >
                  <WebsiteOrderAttachments
                    key={attachmentsVersion}
                    orderId={order.id}
                    locale={locale}
                    draft={attachmentDraft}
                    onDraftChange={setAttachmentDraft}
                  />
                </WebsiteOrderAdminActions>
                {deleteError ? <p className="text-center text-sm font-medium text-red-600">{deleteError}</p> : null}
              </div>

              {/* Right column: only what the order costs — payment and products. */}
              <div className="flex flex-col gap-4 lg:self-start">
                <div className="rounded-2xl border border-black/10 bg-white p-6">
                  <h3 className="mb-3 text-lg font-semibold text-logoblue">{t("Payment", "Betaling")}</h3>
                  <WebsiteOrderPaymentSummary comparison={order.payment} locale={locale} />
                </div>
                {/* The same calculator for a delivery and a move — set to 0,
                    discount/extra, partner minus/plus and "Use new price". */}
                {order.calculator ? (
                  <WebsiteOrderCalculator
                    key={`${order.priceExVat}|${JSON.stringify(order.calculator)}|${JSON.stringify(calculatorAdjustments)}`}
                    orderId={order.id}
                    calculator={order.calculator}
                    adjustments={calculatorAdjustments}
                    missingFromLines={order.totalsCheck.missingFromLines}
                    storedTotal={order.priceExVat}
                    currentPricesTotal={order.currentPricesTotal ?? null}
                    priceChanges={order.priceChanges ?? []}
                    {...(order.kind === "moving"
                      ? { previewEndpoint: `/api/orders/${order.id}/moving-details` }
                      : { savedPricesIncomplete: order.savedPricesIncomplete ?? [] })}
                    locale={locale}
                    onDraftChange={setPricingDraft}
                    priceChangeTarget={priceChangeSlot}
                  />
                ) : (
                <div className="rounded-2xl border border-black/10 bg-white p-6">
                  <h3 className="text-lg font-semibold text-logoblue">{t("Products", "Varer")}</h3>
                  <p className="text-xs text-black/45">{t("Prices ex. VAT", "Priser eks. mva")}</p>

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

                  {orderExtras.length > 0 && (
                    <div className="mt-4 border-t border-black/10 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                        {t("Order extras", "Tillegg til ordren")}
                      </p>
                      <div className="mt-2 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1.5 pl-1 text-sm">
                        {orderExtras.map((line, index) => (
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
                    {/* Same order as the booking app's calculator: the ex-VAT total leads. */}
                    <div className="mt-1 flex items-center justify-between gap-4 rounded-xl bg-logoblue/10 px-4 py-4">
                      <span className="text-base font-semibold text-logoblue">{t("Total", "Totalt")}</span>
                      <span className="whitespace-nowrap text-3xl font-bold tabular-nums text-logoblue">
                        {formatKr(vat.exVat)}
                      </span>
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
                </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
