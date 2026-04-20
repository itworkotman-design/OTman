"use client";

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
import { getOrderStatusStyle } from "@/lib/orders/statusPresentation";

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
};

const SELECT_COLUMN_WIDTH = 48;

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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("no-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "-";
  return `NOK ${value}`;
}

function formatStatusCell(value: string | null | undefined) {
  const cell = formatCell(value);
  if (cell === "-") return cell;

  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-semibold"
      style={getOrderStatusStyle(value)}
      title={value ?? ""}
    >
      {cell}
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
}: BookingArchiveTableProps) {
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

  return (
    <div className="mb-10 max-h-[1000] w-full max-w-full overflow-x-auto overflow-y-auto [-webkit-overflow-scrolling:touch] lg:max-w-[calc(100vw-300px)]">
      <table
        className="table-fixed border-y border-black/10 text-sm"
        style={{ width: `${tableWidth}px`, minWidth: `${tableWidth}px` }}
      >
        <colgroup>
          {selectable ? (
            <col style={{ width: `${SELECT_COLUMN_WIDTH}px` }} />
          ) : null}
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
              <th
                data-selector-cell="true"
                className="w-12 border-r border-black/3 px-3 py-3 font-medium"
              >
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => onToggleAllVisible?.()}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
            )}

            {viewMode === "ADMIN" && (
              <>
                {isColumnVisible("displayId") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    ID
                  </th>
                ) : null}
                {isColumnVisible("status") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Status
                  </th>
                ) : null}
                {isColumnVisible("mail") ? (
                  <th className="w-[60] min-w-[60] border-r border-black/3 px-2 py-3 text-center font-medium">
                    Alerts
                  </th>
                ) : null}
                {isColumnVisible("deliveryDate") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Delivery date
                  </th>
                ) : null}
                {isColumnVisible("timeWindow") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Time window
                  </th>
                ) : null}
                {isColumnVisible("customerLabel") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Customer
                  </th>
                ) : null}
                {isColumnVisible("orderNumber") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Order no.
                  </th>
                ) : null}
                {isColumnVisible("customerName") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Customer name
                  </th>
                ) : null}
                {isColumnVisible("phone") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Phone
                  </th>
                ) : null}
                {isColumnVisible("pickupAddress") ? (
                  <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                    Pickup address
                  </th>
                ) : null}
                {isColumnVisible("extraPickupAddress") ? (
                  <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                    Extra pickup
                  </th>
                ) : null}
                {isColumnVisible("deliveryAddress") ? (
                  <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                    Delivery address
                  </th>
                ) : null}
                {isColumnVisible("orderSummary") ? (
                  <th className="whitespace-nowrap border-r w-[340] min-w-[340] border-black/3 px-4 py-3 font-medium">
                    Products
                  </th>
                ) : null}
                {isColumnVisible("description") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Description
                  </th>
                ) : null}
                {isColumnVisible("cashierName") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Cashier name
                  </th>
                ) : null}
                {isColumnVisible("cashierPhone") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Cashier phone
                  </th>
                ) : null}
                {isColumnVisible("customerComments") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Customer notes
                  </th>
                ) : null}
                {isColumnVisible("driverInfo") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Driver info
                  </th>
                ) : null}
                {isColumnVisible("subcontractor") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Subcontractor
                  </th>
                ) : null}
                {isColumnVisible("createdAt") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Created at
                  </th>
                ) : null}
                {isColumnVisible("updatedAt") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Last edited
                  </th>
                ) : null}
                {isColumnVisible("priceExVat") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Price ex. VAT
                  </th>
                ) : null}
                {isColumnVisible("priceSubcontractor") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Subcontractor price
                  </th>
                ) : null}
              </>
            )}

            {viewMode === "SUBCONTRACTOR" && (
              <>
                {isColumnVisible("displayId") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    ID
                  </th>
                ) : null}
                {isColumnVisible("status") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Status
                  </th>
                ) : null}
                {isColumnVisible("deliveryDate") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Delivery date
                  </th>
                ) : null}
                {isColumnVisible("timeWindow") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Time window
                  </th>
                ) : null}
                {isColumnVisible("customerName") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Customer
                  </th>
                ) : null}
                {isColumnVisible("orderNumber") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Order no.
                  </th>
                ) : null}
                {isColumnVisible("pickupAddress") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Pickup address
                  </th>
                ) : null}
                {isColumnVisible("extraPickupAddress") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Extra pickup
                  </th>
                ) : null}
                {isColumnVisible("deliveryAddress") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Delivery address
                  </th>
                ) : null}
                {isColumnVisible("orderSummary") ? (
                  <th className="whitespace-nowrap border-r w-[340] min-w-[340] border-black/3 px-2 py-3 font-medium">
                    Products
                  </th>
                ) : null}
                {isColumnVisible("description") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Description
                  </th>
                ) : null}
                {isColumnVisible("cashierName") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Cashier name
                  </th>
                ) : null}
                {isColumnVisible("cashierPhone") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Cashier phone
                  </th>
                ) : null}
                {isColumnVisible("customerComments") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Customer notes
                  </th>
                ) : null}
                {isColumnVisible("driver") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Driver
                  </th>
                ) : null}
                {isColumnVisible("createdBy") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Created by
                  </th>
                ) : null}
                {isColumnVisible("createdAt") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Created at
                  </th>
                ) : null}
                {isColumnVisible("priceExVat") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Price ex. VAT
                  </th>
                ) : null}
              </>
            )}

            {viewMode === "ORDER_CREATOR" && (
              <>
                {isColumnVisible("displayId") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    ID
                  </th>
                ) : null}
                {isColumnVisible("status") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Status
                  </th>
                ) : null}
                {isColumnVisible("statusNotes") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Status notes
                  </th>
                ) : null}
                {isColumnVisible("orderNumber") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Order no.
                  </th>
                ) : null}
                {isColumnVisible("customerName") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Customer name
                  </th>
                ) : null}
                {isColumnVisible("phone") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Phone
                  </th>
                ) : null}
                {isColumnVisible("deliveryDate") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Delivery date
                  </th>
                ) : null}
                {isColumnVisible("priceExVat") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Price ex. VAT
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
                if (
                  (e.target as HTMLElement).closest(
                    '[data-selector-cell="true"]',
                  )
                )
                  return;
                if (
                  (e.target as HTMLElement).closest('[data-alert-cell="true"]')
                )
                  return;
                onRowClick(order.id);
              }}
            >
              {selectable && (
                <td
                  data-selector-cell="true"
                  className="border-r border-black/3 px-3 py-2"
                >
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
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.displayId)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("status") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatStatusCell(order.status)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("mail") ? (
                    <td
                      data-alert-cell="true"
                      className="w-[60] min-w-[60] border-r border-black/3 px-2 py-2 text-center"
                    >
                      {(() => {
                        const hasMailAlert =
                          order.needsEmailAttention ||
                          order.unreadInboundEmailCount > 0;
                        const hasNotificationAlert =
                          order.needsNotificationAttention ||
                          order.unreadNotificationCount > 0;

                        let buttonClassName =
                          "relative flex h-10 w-full items-center justify-center overflow-hidden rounded-md border text-[11px] font-semibold transition";

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
                          buttonClassName +=
                            " border-black/10 bg-white text-textColorThird";
                        }

                        return (
                          <button
                            type="button"
                            className={buttonClassName}
                            onClick={(event) => {
                              event.stopPropagation();
                              onAlertClick(order);
                            }}
                            aria-label={`Open alert center for order ${order.displayId}`}
                            title="Open alert center"
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
                              "Open"
                            )}
                          </button>
                        );
                      })()}
                    </td>
                  ) : null}
                  {isColumnVisible("deliveryDate") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.deliveryDate)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("timeWindow") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.timeWindow)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("customerLabel") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.customerLabel)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("orderNumber") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.orderNumber)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("customerName") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.customerName)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("phone") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.phone)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("pickupAddress") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.pickupAddress)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("extraPickupAddress") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>
                        {order.extraPickupAddress.length > 0
                          ? order.extraPickupAddress.join(", ")
                          : "-"}
                      </Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("deliveryAddress") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.deliveryAddress)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("orderSummary") ? (
                    <td className="w-[340] min-w-[340] border-r border-black/3 px-3 py-2 font-semibold text-textColorThird">
                      <Cell className="whitespace-normal">
                        {renderOrderSummary(
                          order.orderSummaryGroups,
                          order.orderSummaryText,
                        )}
                      </Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("description") ? (
                    <td className="max-w-[180] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.description)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("cashierName") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.cashierName)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("cashierPhone") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.cashierPhone)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("customerComments") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.customerComments)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("driverInfo") ? (
                    <td className="max-w-[180] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.driverInfo)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("subcontractor") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.subcontractor)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("createdAt") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatDateTime(order.createdAt)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("updatedAt") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>
                        {order.lastEditedBy
                          ? `${formatDateTime(order.updatedAt)} (${order.lastEditedBy})`
                          : "-"}
                      </Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("priceExVat") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatMoney(order.priceExVat)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("priceSubcontractor") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatMoney(order.priceSubcontractor)}</Cell>
                    </td>
                  ) : null}
                </>
              )}

              {viewMode === "SUBCONTRACTOR" && (
                <>
                  {isColumnVisible("displayId") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.displayId)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("status") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatStatusCell(order.status)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("deliveryDate") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.deliveryDate)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("timeWindow") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.timeWindow)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("customerName") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.customerName)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("orderNumber") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.orderNumber)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("pickupAddress") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.pickupAddress)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("extraPickupAddress") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>
                        {order.extraPickupAddress.length > 0
                          ? order.extraPickupAddress.join(", ")
                          : "-"}
                      </Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("deliveryAddress") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.deliveryAddress)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("orderSummary") ? (
                    <td className="w-[340] min-w-[340] border-r border-black/3 px-3 py-2 font-semibold text-textColorThird">
                      <Cell className="whitespace-normal">
                        {renderOrderSummary(
                          order.orderSummaryGroups,
                          order.orderSummaryText,
                        )}
                      </Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("description") ? (
                    <td className="max-w-[180] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.description)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("cashierName") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.cashierName)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("cashierPhone") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.cashierPhone)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("customerComments") ? (
                    <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.customerComments)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("driver") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.driver)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("createdBy") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.createdBy)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("createdAt") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatDateTime(order.createdAt)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("priceExVat") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatMoney(order.priceExVat)}</Cell>
                    </td>
                  ) : null}
                </>
              )}

              {viewMode === "ORDER_CREATOR" && (
                <>
                  {isColumnVisible("displayId") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.displayId)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("status") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatStatusCell(order.status)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("statusNotes") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.statusNotes)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("orderNumber") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.orderNumber)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("customerName") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.customerName)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("phone") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.phone)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("deliveryDate") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.deliveryDate)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("priceExVat") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatMoney(order.priceExVat)}</Cell>
                    </td>
                  ) : null}
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {orders.length === 0 && (
        <div className="py-8 text-center text-textColorThird">
          No orders found
        </div>
      )}
    </div>
  );
}

