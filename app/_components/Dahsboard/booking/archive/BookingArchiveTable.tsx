"use client";

import { useRef } from "react";
import type {
  BookingArchiveViewMode,
  OrderRow,
} from "@/app/_components/Dahsboard/booking/archive/types";
import {
  getBookingArchiveColumns,
  getDefaultVisibleBookingArchiveColumns,
  sanitizeVisibleBookingArchiveColumns,
  type BookingArchiveColumnId,
} from "@/lib/booking/archiveColumns";
import {
  getOrderStatusLabel,
  getOrderStatusStyle,
} from "@/lib/orders/statusPresentation";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/dateDisplay";
import {
  bookingStatusText,
  bookingText,
  type BookingUiLocale,
} from "@/lib/booking/bookingUiText";

type BookingArchiveTableProps = {
  orders: OrderRow[];
  viewMode: BookingArchiveViewMode;
  onRowClick: (orderId: string) => void;
  onAlertClick: (order: OrderRow) => void;
  selectable?: boolean;
  selectedOrderIds?: string[];
  onToggleOrder?: (orderId: string) => void;
  onToggleAllVisible?: () => void;
  visibleColumnIds?: BookingArchiveColumnId[];
  locale?: BookingUiLocale;
};

const SELECT_COLUMN_WIDTH = 48;
const ARCHIVE_SCROLLBAR_CLASS =
  "[scrollbar-color:var(--logoblue)_#e5e7eb20] [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar-track]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-logoblue";

const COLUMN_WIDTHS: Record<BookingArchiveColumnId, number> = {
  displayId: 90,
  status: 130,
  mail: 60,
  deliveryDate: 140,
  timeWindow: 140,
  customerLabel: 180,
  orderNumber: 140,
  customerName: 180,
  phone: 160,
  pickupAddress: 220,
  extraPickupAddress: 220,
  deliveryAddress: 220,
  orderSummary: 340,
  description: 220,
  cashierName: 180,
  cashierPhone: 180,
  customerComments: 220,
  driverInfo: 180,
  subcontractor: 180,
  createdAt: 190,
  updatedAt: 230,
  priceExVat: 160,
  priceSubcontractor: 180,
  statusNotes: 220,
  driver: 180,
  createdBy: 180,
};

function formatCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return String(value);
  if (!value.trim()) return "-";
  return value;
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "-";
  return `NOK ${value}`;
}

function formatStatusCell(
  value: string | null | undefined,
  locale: BookingUiLocale,
) {
  const cell = formatCell(getOrderStatusLabel(value));
  if (cell === "-") return cell;
  const normalizedStatus = getOrderStatusLabel(value);
  const label = bookingStatusText(locale, normalizedStatus);

  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-semibold text-weird-landscape padding-weird-landscape"
      style={getOrderStatusStyle(value)}
      title={normalizedStatus}
    >
      {label}
    </span>
  );
}

function renderOrderSummary(
  groups: OrderRow["orderSummaryGroups"],
  fallbackText: string,
) {
  if (groups.length === 0) {
    return formatCell(fallbackText);
  }

  return (
    <div className="space-y-3">
      {groups.map((group, index) => (
        <div key={`${group.title}-${index}`} className="space-y-1">
          <div className="font-semibold text-logoblue">{group.title}</div>
          {group.details.length > 0 ? (
            <div className="space-y-1 pl-3 text-xs font-medium text-textColorThird">
              {group.details.map((detail, detailIndex) => (
                <div key={`${detail}-${detailIndex}`}>- {detail}</div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// Wraps any td content so it scrolls vertically if it exceeds 100px,
// while the row itself stays at natural height determined by the tallest cell.
function Cell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`max-h-[100] overflow-y-auto wrap-break-word ${className}`}>
      {children}
    </div>
  );
}

function AlertCell({
  order,
  onAlertClick,
  openLabel,
}: {
  order: OrderRow;
  onAlertClick: (order: OrderRow) => void;
  openLabel: string;
}) {
  const hasMailAlert =
    order.needsEmailAttention || order.unreadInboundEmailCount > 0;
  const hasNotificationAlert =
    order.needsNotificationAttention || order.unreadNotificationCount > 0;

  let buttonClassName =
    "relative flex h-10 w-full items-center justify-center overflow-hidden rounded-md border text-[11px] font-semibold transition height-weird-landscape text-weird-landscape";

  if (hasMailAlert && hasNotificationAlert) {
    buttonClassName +=
      " border-amber-300 bg-white shadow-[0_0_12px_rgba(245,158,11,0.35)]";
  } else if (hasMailAlert) {
    buttonClassName +=
      " border-logoblue bg-logoblue text-white shadow-[0_0_12px_rgba(37,99,235,0.35)]";
  } else if (hasNotificationAlert) {
    buttonClassName +=
      " border-amber-400 bg-amber-300 text-amber-950 shadow-[0_0_12px_rgba(245,158,11,0.35)]";
  } else {
    buttonClassName += " border-black/10 bg-white text-textColorThird";
  }

  return (
    <td
      data-alert-cell="true"
      className="w-[60] min-w-[60] border-r border-black/3 px-2 py-2 text-center"
    >
      <button
        type="button"
        className={buttonClassName}
        onClick={(event) => {
          event.stopPropagation();
          onAlertClick(order);
        }}
        aria-label={`Open alert center for order ${order.displayId}`}
        title={openLabel}
      >
        {hasMailAlert && hasNotificationAlert ? (
          <>
            <span className="flex h-full w-1/2 items-center justify-center bg-logoblue text-white">
              M
            </span>
            <span className="h-full w-px bg-white/80" />
            <span className="flex h-full w-1/2 items-center justify-center bg-amber-300 text-amber-950">
              A
            </span>
          </>
        ) : hasMailAlert ? (
          "M"
        ) : hasNotificationAlert ? (
          "A"
        ) : (
          openLabel
        )}
      </button>
    </td>
  );
}

export default function BookingArchiveTable({
  orders,
  viewMode,
  onRowClick,
  onAlertClick,
  selectable = false,
  selectedOrderIds = [],
  onToggleOrder,
  onToggleAllVisible,
  visibleColumnIds,
  locale = "en",
}: BookingArchiveTableProps) {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const t = (text: string) => bookingText(locale, text);
  const resolvedVisibleColumnIds =
    visibleColumnIds && visibleColumnIds.length > 0
      ? sanitizeVisibleBookingArchiveColumns(viewMode, visibleColumnIds)
      : getDefaultVisibleBookingArchiveColumns(viewMode);
  const visibleColumnSet = new Set(resolvedVisibleColumnIds);
  const visibleColumns = getBookingArchiveColumns(viewMode).filter((column) =>
    visibleColumnSet.has(column.id),
  );
  const tableWidth = visibleColumns.reduce(
    (totalWidth, column) => totalWidth + COLUMN_WIDTHS[column.id],
    selectable ? SELECT_COLUMN_WIDTH : 0,
  );

  function isColumnVisible(columnId: BookingArchiveColumnId) {
    return visibleColumnSet.has(columnId);
  }

  const allVisibleSelected =
    orders.length > 0 &&
    orders.every((order) => selectedOrderIds.includes(order.id));

  function syncTopScroll(event: React.UIEvent<HTMLDivElement>) {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
  }

  function syncTableScroll(event: React.UIEvent<HTMLDivElement>) {
    if (topScrollRef.current) {
      topScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
  }

  return (
    <div className="mb-10 min-w-0 w-full">
      <div
        ref={topScrollRef}
        className={`h-4 min-w-0 w-full overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] ${ARCHIVE_SCROLLBAR_CLASS}`}
        onScroll={syncTopScroll}
        aria-hidden="true"
      >
        <div
          className="h-px"
          style={{ width: `${tableWidth}px`, minWidth: `${tableWidth}px` }}
        />
      </div>

      <div
        ref={tableScrollRef}
        className={`max-h-[1000] min-w-0 w-full overflow-x-auto overflow-y-auto [-webkit-overflow-scrolling:touch] ${ARCHIVE_SCROLLBAR_CLASS}`}
        onScroll={syncTableScroll}
      >
        <table className="table-fixed border-y border-black/10 text-sm" style={{ width: `${tableWidth}px`, minWidth: `${tableWidth}px` }}>
        <colgroup>
          {selectable ? <col style={{ width: `${SELECT_COLUMN_WIDTH}px` }} /> : null}
          {visibleColumns.map((column) => (
            <col
              key={column.id}
              style={{
                width: `${COLUMN_WIDTHS[column.id]}px`,
                minWidth: `${COLUMN_WIDTHS[column.id]}px`,
                maxWidth: `${COLUMN_WIDTHS[column.id]}px`,
              }}
            />
          ))}
        </colgroup>
        <thead>
          <tr className="border-y border-black/10 bg-black/3 text-left text-textColorSecond">
            {selectable && (
              <th data-selector-cell="true" className="w-12 border-r border-black/3 px-3 py-3 font-medium padding-weird-landscape text-weird-landscape">
                <input type="checkbox" checked={allVisibleSelected} onChange={() => onToggleAllVisible?.()} onClick={(e) => e.stopPropagation()} />
              </th>
            )}

            {viewMode === "ADMIN" && (
              <>
                {isColumnVisible("displayId") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">ID</th>
                ) : null}
                {isColumnVisible("status") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Status")}
                  </th>
                ) : null}
                {isColumnVisible("mail") ? (
                  <th className="w-[60] min-w-[60] border-r border-black/3 px-2 py-3 text-center font-medium text-weird-landscape padding-weird-landscape">
                    {t("Alerts")}
                  </th>
                ) : null}
                {isColumnVisible("deliveryDate") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Delivery date")}
                  </th>
                ) : null}
                {isColumnVisible("timeWindow") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Time window")}
                  </th>
                ) : null}
                {isColumnVisible("createdBy") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">{t("Store")}</th>
                ) : null}
                {isColumnVisible("orderNumber") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Order no.")}
                  </th>
                ) : null}
                {isColumnVisible("customerLabel") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Customer name")}
                  </th>
                ) : null}
                {isColumnVisible("phone") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">{t("Phone")}</th>
                ) : null}
                {isColumnVisible("pickupAddress") ? (
                  <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Pickup address")}
                  </th>
                ) : null}
                {isColumnVisible("extraPickupAddress") ? (
                  <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Extra pickup")}
                  </th>
                ) : null}
                {isColumnVisible("deliveryAddress") ? (
                  <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Delivery address")}
                  </th>
                ) : null}
                {isColumnVisible("orderSummary") ? (
                  <th className="whitespace-nowrap border-r w-[340] min-w-[340] border-black/3 px-4 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Products")}
                  </th>
                ) : null}
                {isColumnVisible("description") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Description")}
                  </th>
                ) : null}
                {isColumnVisible("cashierName") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Cashier name")}
                  </th>
                ) : null}
                {isColumnVisible("cashierPhone") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Cashier phone")}
                  </th>
                ) : null}
                {isColumnVisible("customerComments") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Customer notes")}
                  </th>
                ) : null}
                {isColumnVisible("driverInfo") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Driver info")}
                  </th>
                ) : null}
                {isColumnVisible("subcontractor") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Subcontractor")}
                  </th>
                ) : null}
                {isColumnVisible("createdAt") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Created at")}
                  </th>
                ) : null}
                {isColumnVisible("updatedAt") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Last edited")}
                  </th>
                ) : null}
                {isColumnVisible("priceExVat") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Price ex. VAT")}
                  </th>
                ) : null}
                {isColumnVisible("priceSubcontractor") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Subcontractor price")}
                  </th>
                ) : null}
              </>
            )}

            {viewMode === "SUBCONTRACTOR" && (
              <>
                {isColumnVisible("displayId") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">ID</th>
                ) : null}
                {isColumnVisible("status") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Status")}
                  </th>
                ) : null}
                {isColumnVisible("deliveryDate") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Delivery date")}
                  </th>
                ) : null}
                {isColumnVisible("timeWindow") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Time window")}
                  </th>
                ) : null}
                {isColumnVisible("customerName") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Customer name")}
                  </th>
                ) : null}
                {isColumnVisible("orderNumber") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Order no.")}
                  </th>
                ) : null}
                {isColumnVisible("pickupAddress") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Pickup address")}
                  </th>
                ) : null}
                {isColumnVisible("extraPickupAddress") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Extra pickup")}
                  </th>
                ) : null}
                {isColumnVisible("deliveryAddress") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Delivery address")}
                  </th>
                ) : null}
                {isColumnVisible("orderSummary") ? (
                  <th className="whitespace-nowrap border-r w-[340] min-w-[340] border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Products")}
                  </th>
                ) : null}
                {isColumnVisible("description") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Description")}
                  </th>
                ) : null}
                {isColumnVisible("cashierName") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Cashier name")}
                  </th>
                ) : null}
                {isColumnVisible("cashierPhone") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Cashier phone")}
                  </th>
                ) : null}
                {isColumnVisible("customerComments") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Customer notes")}
                  </th>
                ) : null}
                {isColumnVisible("driver") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Driver")}
                  </th>
                ) : null}
                {isColumnVisible("createdBy") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">{t("Store")}</th>
                ) : null}
                {isColumnVisible("createdAt") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Created at")}
                  </th>
                ) : null}
                {isColumnVisible("priceSubcontractor") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Subcontractor price")}
                  </th>
                ) : null}
              </>
            )}

            {viewMode === "ORDER_CREATOR" && (
              <>
                {isColumnVisible("displayId") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">ID</th>
                ) : null}
                {isColumnVisible("status") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Status")}
                  </th>
                ) : null}
                {isColumnVisible("mail") ? (
                  <th className="w-[60] min-w-[60] border-r border-black/3 px-2 py-3 text-center font-medium padding-weird-landscape text-weird-landscape ">
                    {t("Alerts")}
                  </th>
                ) : null}
                {isColumnVisible("statusNotes") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Status notes")}
                  </th>
                ) : null}
                {isColumnVisible("orderNumber") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Order no.")}
                  </th>
                ) : null}
                {isColumnVisible("customerName") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Customer name")}
                  </th>
                ) : null}
                {isColumnVisible("phone") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">{t("Phone")}</th>
                ) : null}
                {isColumnVisible("deliveryDate") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Delivery date")}
                  </th>
                ) : null}
                {isColumnVisible("priceExVat") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium padding-weird-landscape text-weird-landscape">
                    {t("Price ex. VAT")}
                  </th>
                ) : null}
              </>
            )}
          </tr>
        </thead>

        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              className="cursor-pointer border-b border-black/10 hover:bg-black/2"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-selector-cell="true"]')) return;
                if ((e.target as HTMLElement).closest('[data-alert-cell="true"]')) return;
                onRowClick(order.id);
              }}
            >
              {selectable && (
                <td data-selector-cell="true" className="border-r border-black/3 px-3 py-2 padding-weird-landscape text-weird-landscape">
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.includes(order.id)}
                    onChange={() => onToggleOrder?.(order.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
              )}

              {viewMode === "ADMIN" && (
                <>
                  {isColumnVisible("displayId") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.displayId)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("status") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatStatusCell(order.status, locale)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("mail") ? <AlertCell order={order} onAlertClick={onAlertClick} openLabel={t("Open")} /> : null}
                  {isColumnVisible("deliveryDate") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatDisplayDate(order.deliveryDate)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("timeWindow") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.timeWindow)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("createdBy") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.createdBy)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("orderNumber") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.orderNumber)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("customerLabel") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.customerName)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("phone") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.phone)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("pickupAddress") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.pickupAddress)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("extraPickupAddress") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{order.extraPickupAddress.length > 0 ? order.extraPickupAddress.join(", ") : "-"}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("deliveryAddress") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.deliveryAddress)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("orderSummary") ? (
                    <td className="w-[340] min-w-[340] border-r border-black/3 px-3 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell className="whitespace-normal">{renderOrderSummary(order.orderSummaryGroups, order.orderSummaryText)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("description") ? (
                    <td className="max-w-[180] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.description)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("cashierName") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.cashierName)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("cashierPhone") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.cashierPhone)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("customerComments") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.customerComments)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("driverInfo") ? (
                    <td className="max-w-[180] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.driverInfo)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("subcontractor") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.subcontractor)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("createdAt") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatDisplayDateTime(order.createdAt)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("updatedAt") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{order.lastEditedBy ? `${formatDisplayDateTime(order.updatedAt)} (${order.lastEditedBy})` : "-"}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("priceExVat") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatMoney(order.priceExVat)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("priceSubcontractor") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatMoney(order.priceSubcontractor)}</Cell>
                    </td>
                  ) : null}
                </>
              )}

              {viewMode === "SUBCONTRACTOR" && (
                <>
                  {isColumnVisible("displayId") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.displayId)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("status") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatStatusCell(order.status, locale)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("deliveryDate") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatDisplayDate(order.deliveryDate)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("timeWindow") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.timeWindow)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("customerName") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.customerName)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("orderNumber") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.orderNumber)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("pickupAddress") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.pickupAddress)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("extraPickupAddress") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{order.extraPickupAddress.length > 0 ? order.extraPickupAddress.join(", ") : "-"}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("deliveryAddress") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.deliveryAddress)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("orderSummary") ? (
                    <td className="w-[340] min-w-[340] border-r border-black/3 px-3 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell className="whitespace-normal">{renderOrderSummary(order.orderSummaryGroups, order.orderSummaryText)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("description") ? (
                    <td className="max-w-[180] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.description)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("cashierName") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.cashierName)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("cashierPhone") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.cashierPhone)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("customerComments") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.customerComments)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("driver") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.driver)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("createdBy") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.createdBy)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("createdAt") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatDisplayDateTime(order.createdAt)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("priceSubcontractor") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatMoney(order.priceSubcontractor)}</Cell>
                    </td>
                  ) : null}
                </>
              )}

              {viewMode === "ORDER_CREATOR" && (
                <>
                  {isColumnVisible("displayId") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.displayId)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("status") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatStatusCell(order.status, locale)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("mail") ? <AlertCell order={order} onAlertClick={onAlertClick} openLabel={t("Open")} /> : null}
                  {isColumnVisible("statusNotes") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.statusNotes)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("orderNumber") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.orderNumber)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("customerName") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.customerName)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("phone") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatCell(order.phone)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("deliveryDate") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatDisplayDate(order.deliveryDate)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("priceExVat") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird padding-weird-landscape text-weird-landscape">
                      <Cell>{formatMoney(order.priceExVat)}</Cell>
                    </td>
                  ) : null}
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

        {orders.length === 0 && <div className="py-8 text-center text-textColorThird padding-weird-landscape text-weird-landscape">{t("No orders found")}</div>}
      </div>
    </div>
  );
}
