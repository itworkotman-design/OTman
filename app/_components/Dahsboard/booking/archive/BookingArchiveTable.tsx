"use client";

import type {
  BookingArchiveViewMode,
  OrderRow,
} from "@/app/_components/Dahsboard/booking/archive/types";

type BookingArchiveTableProps = {
  orders: OrderRow[];
  viewMode: BookingArchiveViewMode;
  onRowClick: (orderId: string) => void;
  selectable?: boolean;
  selectedOrderIds?: string[];
  onToggleOrder?: (orderId: string) => void;
  onToggleAllVisible?: () => void;
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

function getStatusStyle(status: string | null | undefined) {
  const key = (status ?? "").toString().trim().toLowerCase();

  switch (key) {
    case "behandles":
      return { color: "#b45309", backgroundColor: "#fef3c7" };
    case "bekreftet":
    case "confirmed":
      return { color: "#0f766e", backgroundColor: "#cffafe" };
    case "aktiv":
    case "active":
      return { color: "#5b21b6", backgroundColor: "#ede9fe" };
    case "kanselert":
    case "cancelled":
    case "canceled":
      return { color: "#ea580c", backgroundColor: "#ffedd5" };
    case "fail":
      return { color: "#7c3aed", backgroundColor: "#ede9fe" };
    case "ferdig":
    case "completed":
      return { color: "#15803d", backgroundColor: "#dcfce7" };
    case "fakturet":
    case "invoiced":
      return { color: "#064e3b", backgroundColor: "#d1fae5" };
    case "betalt":
    case "paid":
      return { color: "#6b7280", backgroundColor: "#f3f4f6" };
    default:
      return { color: "inherit", backgroundColor: "transparent" };
  }
}

function formatStatusCell(value: string | null | undefined) {
  const cell = formatCell(value);
  if (cell === "-") return cell;

  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-semibold"
      style={getStatusStyle(value)}
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
    <div className={`max-h-[100] overflow-y-auto ${className}`}>
      {children}
    </div>
  );
}

export default function BookingArchiveTable({
  orders,
  viewMode,
  onRowClick,
  selectable = false,
  selectedOrderIds = [],
  onToggleOrder,
  onToggleAllVisible,
}: BookingArchiveTableProps) {
  const allVisibleSelected =
    orders.length > 0 &&
    orders.every((order) => selectedOrderIds.includes(order.id));

  return (
    <div className="w-full max-w-full lg:max-w-[calc(100vw-300px)] mb-10 max-h-[1000] overflow-x-auto overflow-y-auto [-webkit-overflow-scrolling:touch]">
      <table className="w-full min-w-[1200] max-w-[4000] border-y border-black/10 text-sm">
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
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  ID
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Status
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Leveringsdato
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Tidsvindu
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Customer
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Best.nr
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Navn
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Telefon
                </th>
                <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                  Pickup Adresse
                </th>
                <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                  Extra pickup
                </th>
                <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                  Leveringsadresse
                </th>
                <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                  Produkter
                </th>
                <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                  Leveringstype
                </th>
                <th className="whitespace-nowrap border-r w-[300] min-w-[300] border-black/3 px-4 py-3 font-medium">
                  Montering/retur
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Beskrivelse
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Kasserers navn
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Kasserers telefon
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Kundenotater
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Driver info
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Subcontractor
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Bestillingsdato
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Sist redigert
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Pris uten MVA
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-medium">
                  Pris Subcontractor
                </th>
              </>
            )}

            {viewMode === "SUBCONTRACTOR" && (
              <>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Status
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Leveringsdato
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Tidsvindu
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Customer
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Best.nr
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Pickup Adresse
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Extra pickup
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Leveringsadresse
                </th>
                <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                  Produkter
                </th>
                <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                  Leveringstype
                </th>
                <th className="whitespace-nowrap border-r w-[220] min-w-[220] border-black/3 px-2 py-3 font-medium">
                  Montering/retur
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Beskrivelse
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Kasserers navn
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Kasserers telefon
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Kundenotater
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Driver
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Opprettet av
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Bestillingsdato
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-medium">
                  TotalPris
                </th>
              </>
            )}

            {viewMode === "ORDER_CREATOR" && (
              <>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Status
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Status notater
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Bestillings nr
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Kundens navn
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Kundens telefon
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-2 py-3 font-medium">
                  Leveringsdato
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-medium">
                  Pris uten MVA
                </th>
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
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.displayId)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatStatusCell(order.status)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.deliveryDate)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.timeWindow)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.customerLabel)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.orderNumber)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.customerName)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.phone)}</Cell>
                  </td>
                  <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.pickupAddress)}</Cell>
                  </td>
                  <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>
                      {order.extraPickupAddress.length > 0
                        ? order.extraPickupAddress.join(", ")
                        : "-"}
                    </Cell>
                  </td>
                  <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.deliveryAddress)}</Cell>
                  </td>
                  <td className="w-[220] min-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell className=" wrap-break-word">
                      {formatCell(order.productsSummary)}
                    </Cell>
                  </td>
                  <td className="w-[220] min-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell className="whitespace-normal wrap-break-word">
                      {formatCell(order.deliveryTypeSummary)}
                    </Cell>
                  </td>
                  <td className="w-[300p min-w-[300] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell className="whitespace-normal wrap-break-word">
                      {formatCell(order.servicesSummary)}
                    </Cell>
                  </td>
                  <td className="max-w-[180] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.description)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.cashierName)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.cashierPhone)}</Cell>
                  </td>
                  <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.customerComments)}</Cell>
                  </td>
                  <td className="max-w-[180] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.driverInfo)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.subcontractor)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatDateTime(order.createdAt)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>
                      {order.lastEditedBy
                        ? `${formatDateTime(order.updatedAt)} (${order.lastEditedBy})`
                        : "-"}
                    </Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatMoney(order.priceExVat)}</Cell>
                  </td>
                  <td className="px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatMoney(order.priceSubcontractor)}</Cell>
                  </td>
                </>
              )}

              {viewMode === "SUBCONTRACTOR" && (
                <>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatStatusCell(order.status)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.deliveryDate)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.timeWindow)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.customerName)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.orderNumber)}</Cell>
                  </td>
                  <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.pickupAddress)}</Cell>
                  </td>
                  <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>
                      {order.extraPickupAddress.length > 0
                        ? order.extraPickupAddress.join(", ")
                        : "-"}
                    </Cell>
                  </td>
                  <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.deliveryAddress)}</Cell>
                  </td>
                  <td className="w-[220] min-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.productsSummary)}</Cell>
                  </td>
                  <td className="w-[220] min-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.deliveryTypeSummary)}</Cell>
                  </td>
                  <td className="w-[300] min-w-[300] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.servicesSummary)}</Cell>
                  </td>
                  <td className="max-w-[180] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.description)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.cashierName)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.cashierPhone)}</Cell>
                  </td>
                  <td className="max-w-[220] border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.customerComments)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.driver)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.createdBy)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatDateTime(order.createdAt)}</Cell>
                  </td>
                  <td className="px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatMoney(order.priceExVat)}</Cell>
                  </td>
                </>
              )}

              {viewMode === "ORDER_CREATOR" && (
                <>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatStatusCell(order.status)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.statusNotes)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.orderNumber)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.customerName)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.phone)}</Cell>
                  </td>
                  <td className="border-r border-black/3 px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatCell(order.deliveryDate)}</Cell>
                  </td>
                  <td className="px-2 py-2 font-semibold text-textColorThird">
                    <Cell>{formatMoney(order.priceExVat)}</Cell>
                  </td>
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
