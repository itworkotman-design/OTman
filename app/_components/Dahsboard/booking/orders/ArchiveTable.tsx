"use client";

import { useMemo } from "react";
import type { AppliedFilters } from "@/app/_components/Dahsboard/booking/orders/TopFiltersField";
import type { OrderRow } from "@/lib/_mockdb";

type ArchiveTableProps = {
  filters: AppliedFilters;
  selectedIds: string[];
  onSelectedIdsChange: (next: string[]) => void;
  orders: OrderRow[];
  onRowClick?: (row: OrderRow) => void;
};

export function ArchiveTable({
  filters,
  selectedIds,
  onSelectedIdsChange,
  orders,
  onRowClick,
}: ArchiveTableProps) {
  const { rows, total } = useMemo(() => {
    const {
      status,
      client,
      subcontractor,
      fromDate,
      toDate,
      search,
      rowsPerPage,
      page,
    } = filters;

    const q = search.trim().toLowerCase();

    let filtered = orders.slice();

    if (status) filtered = filtered.filter((o) => o.status === status);
    if (client) filtered = filtered.filter((o) => o.client === client);
    if (subcontractor)
      filtered = filtered.filter((o) => o.subcontractor === subcontractor);
    if (fromDate)
      filtered = filtered.filter((o) => o.deliveryDate >= fromDate);
    if (toDate)
      filtered = filtered.filter((o) => o.deliveryDate <= toDate);

    if (q) {
      filtered = filtered.filter((o) => {
        const productsText = o.products.join(", ").toLowerCase();
        return (
          o.id.toLowerCase().includes(q) ||
          o.orderNo.toLowerCase().includes(q) ||
          o.name.toLowerCase().includes(q) ||
          o.phone.toLowerCase().includes(q) ||
          o.client.toLowerCase().includes(q) ||
          o.pickupAddress.toLowerCase().includes(q) ||
          o.deliveryAddress.toLowerCase().includes(q) ||
          productsText.includes(q)
        );
      });
    }

    const total = filtered.length;
    const start = (page - 1) * rowsPerPage;
    const rows = filtered.slice(start, start + rowsPerPage);

    return { rows, total };
  }, [filters, orders]);

  const allChecked =
    rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  const toggleAll = () => {
    if (allChecked) {
      const visible = new Set(rows.map((r) => r.id));
      onSelectedIdsChange(
        selectedIds.filter((id) => !visible.has(id))
      );
    } else {
      const next = new Set(selectedIds);
      rows.forEach((r) => next.add(r.id));
      onSelectedIdsChange([...next]);
    }
  };

  const toggleOne = (id: string) => {
    onSelectedIdsChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <section className="border border-b-gray-200">
      <div className="px-2 py-2 text-xs text-neutral-600">
        Showing {rows.length} of {total}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-max table-auto border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-logoblue text-white divide-x divide-neutral-300">
              <Th className="w-10">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="h-4 w-4"
                  aria-label="Select all"
                />
              </Th>
              <Th className="w-15">ID</Th>
              <Th className="w-20">Status</Th>
              <Th className="w-20">Delivery date</Th>
              <Th className="w-22.5">
                Time <br /> window
              </Th>
              <Th className="w-25">Customer</Th>
              <Th>Order no.</Th>
              <Th className="w-25">Name</Th>
              <Th>Phone</Th>
              <Th className="w-25">
                Pickup <br /> address
              </Th>
              <Th className="w-25">
                Extra <br /> pickup
              </Th>
              <Th className="w-25">
                Delivery <br /> address
              </Th>
              <Th className="w-25">
                Return <br /> address
              </Th>
              <Th className="w-50">Products</Th>
              <Th>
                Delivery <br /> type
              </Th>
              <Th className="w-50">Monitoring/ return</Th>
              <Th className="w-50">Description</Th>
              <Th>Cashier name</Th>
              <Th>Cashier phone</Th>
              <Th className="max-w-50">
                Customer <br /> notes
              </Th>
              <Th className="w-50">Driver info</Th>
              <Th>Order date</Th>
              <Th>Last edited</Th>
              <Th className="text-right">
                Price ex <br /> VAT
              </Th>
              <Th className="text-right">Subcontractor</Th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-300">
            {rows.map((r) => {
              const checked = selectedIds.includes(r.id);
              return (
                <tr
                  key={r.id}
                  className="hover:bg-neutral-50 divide-x divide-neutral-300"
                >
                  <Td className="w-10">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(r.id)}
                      className="h-4 w-4"
                      aria-label={`Select booking ${r.id}`}
                    />
                  </Td>

                  <Td className="whitespace-nowrap font-medium">{r.id}</Td>
                  <Td>{r.status}</Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(r.deliveryDate)}
                  </Td>
                  <Td className="whitespace-nowrap">{r.timeWindow}</Td>

                  <Td>{r.client}</Td>
                  <Td className="whitespace-nowrap">{r.orderNo}</Td>
                  <Td>{r.name}</Td>
                  <Td className="whitespace-nowrap">{r.phone}</Td>

                  <Td>{r.pickupAddress}</Td>
                  <Td>{r.extraPickup || "—"}</Td>
                  <Td>{r.deliveryAddress}</Td>
                  <Td>{r.returnAddress || "—"}</Td>

                  <Td>{r.products.join(", ")}</Td>
                  <Td>{r.deliveryType || "—"}</Td>
                  <Td>{r.monitoringOrReturn || "—"}</Td>
                  <Td>{r.description || "—"}</Td>

                  <Td>{r.cashierName || "—"}</Td>
                  <Td className="whitespace-nowrap">
                    {r.cashierPhone || "—"}
                  </Td>

                  <Td>{r.customerNotes || "—"}</Td>
                  <Td>{r.driverInfo || "—"}</Td>

                  <Td>{formatDate(r.orderDate)}</Td>
                  <Td>{r.lastEdited}</Td>

                  <Td className="text-right">
                    {formatMoney(r.priceExVat)}
                  </Td>
                  <Td className="text-right">
                    {r.subcontractor || "—"}
                  </Td>

                  <td className="hidden">
                    <button
                      type="button"
                      onClick={() => onRowClick?.(r)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- helpers ---------- */

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-2 py-3 text-center font-semibold whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2 align-top ${className}`}>
      {children}
    </td>
  );
}

function formatDate(iso: string) {
  return iso;
}

function formatMoney(n: number) {
  return n.toString();
}