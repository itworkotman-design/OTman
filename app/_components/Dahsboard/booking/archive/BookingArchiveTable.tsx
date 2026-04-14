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
  onEmailClick: (order: OrderRow) => void;
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
  productsSummary: 220,
  deliveryTypeSummary: 220,
  servicesSummary: 300,
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
  onEmailClick,
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
                    Mail
                  </th>
                ) : null}
                {isColumnVisible("deliveryDate") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Leveringsdato
                  </th>
                ) : null}
                {isColumnVisible("timeWindow") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Tidsvindu
                  </th>
                ) : null}
                {isColumnVisible("customerLabel") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Customer
                  </th>
                ) : null}
                {isColumnVisible("orderNumber") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Best.nr
                  </th>
                ) : null}
                {isColumnVisible("customerName") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Navn
                  </th>
                ) : null}
                {isColumnVisible("phone") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Telefon
                  </th>
                ) : null}
                {isColumnVisible("pickupAddress") ? (
                  <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                    Pickup Adresse
                  </th>
                ) : null}
                {isColumnVisible("extraPickupAddress") ? (
                  <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                    Extra pickup
                  </th>
                ) : null}
                {isColumnVisible("deliveryAddress") ? (
                  <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                    Leveringsadresse
                  </th>
                ) : null}
                {isColumnVisible("productsSummary") ? (
                  <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                    Produkter
                  </th>
                ) : null}
                {isColumnVisible("deliveryTypeSummary") ? (
                  <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                    Leveringstype
                  </th>
                ) : null}
                {isColumnVisible("servicesSummary") ? (
                  <th className="whitespace-nowrap border-r w-[300] min-w-[300] border-black/3 px-4 py-3 font-medium">
                    Montering/retur
                  </th>
                ) : null}
                {isColumnVisible("description") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Beskrivelse
                  </th>
                ) : null}
                {isColumnVisible("cashierName") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Kasserers navn
                  </th>
                ) : null}
                {isColumnVisible("cashierPhone") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Kasserers telefon
                  </th>
                ) : null}
                {isColumnVisible("customerComments") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Kundenotater
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
                    Bestillingsdato
                  </th>
                ) : null}
                {isColumnVisible("updatedAt") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Sist redigert
                  </th>
                ) : null}
                {isColumnVisible("priceExVat") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Pris uten MVA
                  </th>
                ) : null}
                {isColumnVisible("priceSubcontractor") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Pris Subcontractor
                  </th>
                ) : null}
              </>
            )}

            {viewMode === "SUBCONTRACTOR" && (
              <>
                {isColumnVisible("status") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Status
                  </th>
                ) : null}
                {isColumnVisible("deliveryDate") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Leveringsdato
                  </th>
                ) : null}
                {isColumnVisible("timeWindow") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Tidsvindu
                  </th>
                ) : null}
                {isColumnVisible("customerName") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Customer
                  </th>
                ) : null}
                {isColumnVisible("orderNumber") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Best.nr
                  </th>
                ) : null}
                {isColumnVisible("pickupAddress") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Pickup Adresse
                  </th>
                ) : null}
                {isColumnVisible("extraPickupAddress") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Extra pickup
                  </th>
                ) : null}
                {isColumnVisible("deliveryAddress") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Leveringsadresse
                  </th>
                ) : null}
                {isColumnVisible("productsSummary") ? (
                  <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                    Produkter
                  </th>
                ) : null}
                {isColumnVisible("deliveryTypeSummary") ? (
                  <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                    Leveringstype
                  </th>
                ) : null}
                {isColumnVisible("servicesSummary") ? (
                  <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                    Montering/retur
                  </th>
                ) : null}
                {isColumnVisible("description") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Beskrivelse
                  </th>
                ) : null}
                {isColumnVisible("cashierName") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Kasserers navn
                  </th>
                ) : null}
                {isColumnVisible("cashierPhone") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Kasserers telefon
                  </th>
                ) : null}
                {isColumnVisible("customerComments") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Kundenotater
                  </th>
                ) : null}
                {isColumnVisible("driver") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Driver
                  </th>
                ) : null}
                {isColumnVisible("createdBy") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Opprettet av
                  </th>
                ) : null}
                {isColumnVisible("createdAt") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Bestillingsdato
                  </th>
                ) : null}
                {isColumnVisible("priceExVat") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    TotalPris
                  </th>
                ) : null}
              </>
            )}

            {viewMode === "ORDER_CREATOR" && (
              <>
                {isColumnVisible("status") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Status
                  </th>
                ) : null}
                {isColumnVisible("statusNotes") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Status notater
                  </th>
                ) : null}
                {isColumnVisible("orderNumber") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Bestillings nr
                  </th>
                ) : null}
                {isColumnVisible("customerName") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Kundens navn
                  </th>
                ) : null}
                {isColumnVisible("phone") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Kundens telefon
                  </th>
                ) : null}
                {isColumnVisible("deliveryDate") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Leveringsdato
                  </th>
                ) : null}
                {isColumnVisible("priceExVat") ? (
                  <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                    Pris uten MVA
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
                  (e.target as HTMLElement).closest('[data-email-cell="true"]')
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
                      data-email-cell="true"
                      className="w-[60] min-w-[60] border-r border-black/3 px-2 py-2 text-center"
                    >
                      <button
                        type="button"
                        className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition ${
                          order.needsEmailAttention
                            ? "border-logoblue bg-logoblue text-white cursor-pointer"
                            : "border-black/10 bg-white text-logoblue cursor-pointer"
                        }`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onEmailClick(order);
                        }}
                        aria-label={`Open email modal for order ${order.displayId}`}
                        title="Open email modal"
                      >
                        M
                        {order.unreadInboundEmailCount > 0 ? (
                          <span className="absolute -right-1 -top-1 min-w-[18] rounded-full bg-logored px-1 text-[10px] font-semibold leading-[18] text-white">
                            {order.unreadInboundEmailCount > 99
                              ? "99+"
                              : order.unreadInboundEmailCount}
                          </span>
                        ) : null}
                      </button>
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
                  {isColumnVisible("productsSummary") ? (
                    <td className="w-[220] min-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.productsSummary)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("deliveryTypeSummary") ? (
                    <td className="w-[220] min-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell className="whitespace-normal">
                        {formatCell(order.deliveryTypeSummary)}
                      </Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("servicesSummary") ? (
                    <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell className="whitespace-normal">
                        {formatCell(order.servicesSummary)}
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
                  {isColumnVisible("productsSummary") ? (
                    <td className="w-[220] min-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.productsSummary)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("deliveryTypeSummary") ? (
                    <td className="w-[220] min-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.deliveryTypeSummary)}</Cell>
                    </td>
                  ) : null}
                  {isColumnVisible("servicesSummary") ? (
                    <td className="w-[300] min-w-[300] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                      <Cell>{formatCell(order.servicesSummary)}</Cell>
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
