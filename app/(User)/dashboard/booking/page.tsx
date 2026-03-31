"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import OrderModal from "@/app/_components/Dahsboard/booking/OrderModal";

type OrderRow = {
  id: string;
  status: string;
  statusNotes: string;
  deliveryDate: string;
  timeWindow: string;
  customerName: string;
  orderNumber: string;
  phone: string;
  pickupAddress: string;
  extraPickupAddress: string[];
  deliveryAddress: string;
  productsSummary: string;
  deliveryTypeSummary: string;
  servicesSummary: string;
  description: string;
  cashierName: string;
  cashierPhone: string;
  customerComments: string;
  driverInfo: string;
  subcontractor: string;
  driver: string;
  createdAt: string;
  updatedAt: string;
  priceExVat: number;
  priceSubcontractor: number;
  createdBy: string;
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

export default function BookingPage() {
  const currentUser = useCurrentUser();
  const role = currentUser?.role ?? "USER";

  const viewMode = useMemo(() => {
    const permissions = currentUser?.permissions ?? [];

    if (role === "OWNER" || role === "ADMIN") return "ADMIN";
    if (permissions.includes("BOOKING_CREATE")) return "ORDER_CREATOR";
    return "SUBCONTRACTOR";
  }, [role, currentUser?.permissions]);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/orders", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to load orders");
        return;
      }

      setOrders(data.orders ?? []);
    } catch {
      setError("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();

    return orders.filter((order) => {
      const statusOk = !statusFilter || order.status === statusFilter;

      const queryOk =
        !q ||
        order.id.toLowerCase().includes(q) ||
        order.orderNumber.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.phone.toLowerCase().includes(q) ||
        order.pickupAddress.toLowerCase().includes(q) ||
        order.deliveryAddress.toLowerCase().includes(q) ||
        order.productsSummary.toLowerCase().includes(q) ||
        order.createdBy.toLowerCase().includes(q);

      return statusOk && queryOk;
    });
  }, [orders, query, statusFilter]);

  const availableStatuses = useMemo(() => {
    return Array.from(
      new Set(orders.map((order) => order.status).filter(Boolean)),
    );
  }, [orders]);

  return (
    <div className="mx-auto max-w-[1600]">
      <h1 className="mb-10 whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
        Booking orders
      </h1>

      <div className="shadow-xs flex flex-wrap gap-2 pb-4">
        <select
          className="customInput cursor-pointer duration-200 hover:bg-black/3"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Status</option>
          {availableStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <input
          className="customInput w-72"
          placeholder="Search order, customer, phone, address"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <button
          type="button"
          className="customButtonDefault ml-auto"
          onClick={loadOrders}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-textColorThird">Loading orders...</div>
      ) : error ? (
        <div className="py-6 text-red-600">{error}</div>
      ) : (
        <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full border-y border-black/10 text-sm">
            <thead>
              <tr className="border-y border-black/10 bg-black/3 text-left text-textColorSecond">
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
              {filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  className="cursor-pointer border-b border-black/10 hover:bg-black/2"
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setModalOpen(true);
                  }}
                >
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
                        {formatCell(order.createdBy)}
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
                        {formatCell(order.createdBy)}
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

          {filteredOrders.length === 0 && (
            <div className="py-8 text-center text-textColorThird">
              No orders found
            </div>
          )}
        </div>
      )}
      <OrderModal
        orderId={selectedOrderId}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedOrderId(null);
        }}
      />
    </div>
  );
}
