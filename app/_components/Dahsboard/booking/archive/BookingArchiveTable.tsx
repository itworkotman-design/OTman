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

function formatCell(value: string | null | undefined) {
  if (!value || !value.trim()) return "-";
  return value;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number") return "-";
  return `NOK ${value}`;
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
    <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <table className="w-full border-y border-black/10 text-sm">
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
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  ID
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Status
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Leveringsdato
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Tidsvindu
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Customer
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Best.nr
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Navn
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Telefon
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Pickup Adresse
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Extra pickup
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Leveringsadresse
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Produkter
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Leveringstype
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Montering/retur
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Beskrivelse
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Kasserers navn
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Kasserers telefon
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Kundenotater
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Driver info
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Subcontractor
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Opprettet av
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Bestillingsdato
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Sist redigert
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Pris uten MVA
                </th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">
                  Pris Subcontractor
                </th>
              </>
            )}

            {viewMode === "SUBCONTRACTOR" && (
              <>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Status
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Leveringsdato
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Tidsvindu
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Customer
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Best.nr
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Pickup Adresse
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Extra pickup
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Leveringsadresse
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Produkter
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Leveringstype
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Montering/retur
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Beskrivelse
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Kasserers navn
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Kasserers telefon
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Kundenotater
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Driver
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Opprettet av
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Bestillingsdato
                </th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">
                  TotalPris
                </th>
              </>
            )}

            {viewMode === "ORDER_CREATOR" && (
              <>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Status
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Status notater
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Bestillings nr
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Kundens navn
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Kundens telefon
                </th>
                <th className="whitespace-nowrap border-r border-black/3 px-4 py-3 font-medium">
                  Leveringsdato
                </th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">
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
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.id)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.status)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.deliveryDate)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.timeWindow)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.customerLabel)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.orderNumber)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.customerName)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.phone)}
                  </td>
                  <td className="max-w-[220] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.pickupAddress)}
                  </td>
                  <td className="max-w-[220] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {order.extraPickupAddress.length > 0
                      ? order.extraPickupAddress.join(", ")
                      : "-"}
                  </td>
                  <td className="max-w-[220] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.deliveryAddress)}
                  </td>
                  <td className="max-w-[200] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.productsSummary)}
                  </td>
                  <td className="max-w-[180] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.deliveryTypeSummary)}
                  </td>
                  <td className="max-w-[220] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.servicesSummary)}
                  </td>
                  <td className="max-w-[180] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.description)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.cashierName)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.cashierPhone)}
                  </td>
                  <td className="max-w-[220] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.customerComments)}
                  </td>
                  <td className="max-w-[180] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.driverInfo)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.subcontractor)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.createdBy)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatDateTime(order.createdAt)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatDateTime(order.updatedAt)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatMoney(order.priceExVat)}
                  </td>
                  <td className="px-4 py-2 font-semibold text-textColorThird">
                    {formatMoney(order.priceSubcontractor)}
                  </td>
                </>
              )}

              {viewMode === "SUBCONTRACTOR" && (
                <>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.status)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.deliveryDate)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.timeWindow)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.customerName)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.orderNumber)}
                  </td>
                  <td className="max-w-[220] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.pickupAddress)}
                  </td>
                  <td className="max-w-[220] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {order.extraPickupAddress.length > 0
                      ? order.extraPickupAddress.join(", ")
                      : "-"}
                  </td>
                  <td className="max-w-[220] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.deliveryAddress)}
                  </td>
                  <td className="max-w-[200] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.productsSummary)}
                  </td>
                  <td className="max-w-[180] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.deliveryTypeSummary)}
                  </td>
                  <td className="max-w-[220] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.servicesSummary)}
                  </td>
                  <td className="max-w-[180] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.description)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.cashierName)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.cashierPhone)}
                  </td>
                  <td className="max-w-[220] truncate border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.customerComments)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.driver)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.createdBy)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatDateTime(order.createdAt)}
                  </td>
                  <td className="px-4 py-2 font-semibold text-textColorThird">
                    {formatMoney(order.priceExVat)}
                  </td>
                </>
              )}

              {viewMode === "ORDER_CREATOR" && (
                <>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.status)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.statusNotes)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.orderNumber)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.customerName)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.phone)}
                  </td>
                  <td className="border-r border-black/3 px-4 py-2 font-semibold text-textColorThird">
                    {formatCell(order.deliveryDate)}
                  </td>
                  <td className="px-4 py-2 font-semibold text-textColorThird">
                    {formatMoney(order.priceExVat)}
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
