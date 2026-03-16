"use client";

import { useMemo } from "react";
import type { AppliedFilters } from "@/app/_components/Dahsboard/booking/orders/TopFiltersField";
import type { OrderRow } from "@/lib/_mockdb";

type ArchiveTableProps = {
  filters: AppliedFilters;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  orders: OrderRow[];
  onRowClick: (row: OrderRow) => void;
  visibleColumns?: readonly string[];
  userView?: "admin" | "subcontractor";
};

type ColumnDef = {
  key: string;
  label: React.ReactNode;
  className?: string;
  headerClassName?: string;
  render: (row: OrderRow) => React.ReactNode;
};

const STATUS_CLASSES: Record<string, string> = {
  fail: "text-purple-700",
  confirmed: "text-blue-500",
  behandles: "text-orange-500",
  active: "text-purple-500",
  cancelled: "text-red-500",
  completed: "text-green-500",
  invoiced: "text-green-800",
  betalt: "text-black/30",
};

export function ArchiveTable({
  filters,
  selectedIds,
  onSelectedIdsChange,
  orders,
  onRowClick,
  visibleColumns,
  userView = "admin",
}: ArchiveTableProps) {
  const { rows, total } = useMemo(() => {
    const {
      status,
      customer,
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
    if (customer) {
      filtered = filtered.filter(
        (o) => o.customer.toLowerCase() === customer.toLowerCase()
      );
    }
    if (subcontractor) {
      filtered = filtered.filter((o) => o.subcontractor === subcontractor);
    }
    if (fromDate) {
      filtered = filtered.filter((o) => o.deliveryDate >= fromDate);
    }
    if (toDate) {
      filtered = filtered.filter((o) => o.deliveryDate <= toDate);
    }

    if (q) {
      filtered = filtered.filter((o) => {
        const productsText = Array.isArray(o.products)
          ? o.products.join(", ").toLowerCase()
          : String(o.products ?? "").toLowerCase();

        return (
          o.id.toLowerCase().includes(q) ||
          o.orderNo.toLowerCase().includes(q) ||
          o.name.toLowerCase().includes(q) ||
          o.phone.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          o.pickupAddress.toLowerCase().includes(q) ||
          o.deliveryAddress.toLowerCase().includes(q) ||
          productsText.includes(q)
        );
      });
    }

    filtered.sort((a, b) => {
      const aEmpty = !a.deliveryDate;
      const bEmpty = !b.deliveryDate;
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return -1;
      if (bEmpty) return 1;
      return b.deliveryDate.localeCompare(a.deliveryDate);
    });

    const total = filtered.length;
    const start = (page - 1) * rowsPerPage;
    const rows = filtered.slice(start, start + rowsPerPage);

    return { rows, total };
  }, [filters, orders]);

  const allColumns: ColumnDef[] = [
    {
      key: "id",
      label: "ID",
      className: "whitespace-nowrap font-medium",
      headerClassName: "w-15",
      render: (r) => r.id,
    },
    {
      key: "status",
      label: "Status",
      headerClassName: "w-20",
      className: "",
      render: (r) => (
        <span className={`font-bold ${STATUS_CLASSES[r.status] ?? ""}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: "deliveryDate",
      label: "Leveringsdato",
      headerClassName: "w-20",
      className: "whitespace-nowrap",
      render: (r) => formatDate(r.deliveryDate),
    },
    {
      key: "timeWindow",
      label: (
        <>
          Tidsvindu for
          <br />
          levering
        </>
      ),
      headerClassName: "w-22.5",
      className: "whitespace-nowrap",
      render: (r) => r.timeWindow || "—",
    },
    {
      key: "customer",
      label: "Customer",
      headerClassName: "w-25",
      render: (r) => r.customer || "—",
    },
    {
      key: "orderNo",
      label: "Best.nr",
      className: "whitespace-nowrap",
      render: (r) => r.orderNo || "—",
    },
    {
      key: "name",
      label: "Name",
      headerClassName: "w-25",
      render: (r) => r.name || "—",
    },
    {
      key: "phone",
      label: "Phone",
      className: "whitespace-nowrap",
      render: (r) => r.phone || "—",
    },
    {
      key: "pickupAddress",
      label: (
        <>
          Pickup
          <br />
          Adresse
        </>
      ),
      headerClassName: "w-25",
      render: (r) => r.pickupAddress || "—",
    },
    {
      key: "extraPickup",
      label: (
        <>
          Extra
          <br />
          pickup
        </>
      ),
      headerClassName: "w-25",
      render: (r) => r.extraPickup || "—",
    },
    {
      key: "deliveryAddress",
      label: (
        <>
          Leverings
          <br />
          adresse
        </>
      ),
      headerClassName: "w-25",
      render: (r) => r.deliveryAddress || "—",
    },
    {
      key: "returnAddress",
      label: (
        <>
          Retur
          <br />
          adresse
        </>
      ),
      headerClassName: "w-25",
      render: (r) => r.returnAddress || "—",
    },
    {
      key: "products",
      label: "Produkter",
      headerClassName: "w-50",
      render: (r) =>
        Array.isArray(r.products) ? r.products.join(", ") : r.products || "—",
    },
    {
      key: "deliveryType",
      label: (
        <>
          Leverings
          <br />
          type
        </>
      ),
      render: (r) => r.deliveryType || "—",
    },
    {
      key: "assemblyReturn",
      label: "Montering/retur",
      headerClassName: "w-50",
      render: (r) => r.monitoringOrReturn || "—",
    },
    {
      key: "description",
      label: "Beskrivelse",
      headerClassName: "w-50",
      render: (r) => r.description || "—",
    },
    {
      key: "cashierName",
      label: "Kasserers navn",
      render: (r) => r.cashierName || "—",
    },
    {
      key: "cashierPhone",
      label: "Kasserers telefon",
      className: "whitespace-nowrap",
      render: (r) => r.cashierPhone || "—",
    },
    {
      key: "customerNotes",
      label: (
        <>
          Kunden
          <br />
          otater
        </>
      ),
      headerClassName: "max-w-50",
      render: (r) => r.customerNotes || "—",
    },
    {
      key: "driverInfo",
      label: "Driver",
      headerClassName: "w-50",
      render: (r) => r.driverInfo || "—",
    },
    {
      key: "orderDate",
      label: "Bestillingsdato",
      render: (r) => formatDate(r.orderDate),
    },
    {
      key: "subcontractor",
      label: "Subcontractor",
      className: "text-right",
      headerClassName: "text-right",
      render: (r) => r.subcontractor || "—",
    },
    {
      key: "lastEdited",
      label: "Last edited",
      render: (r) => r.lastEdited || "—",
    },
    {
      key: "totalPriceExVat",
      label: "TotalPris (uten MVA)",
      className: "text-right whitespace-nowrap",
      headerClassName: "text-right",
      render: (r) => `${r.priceExVat ?? 0} kr`,
    },
    {
      key: "priceSubcontractor",
      label: "Pris subcontractor",
      className: "text-right whitespace-nowrap",
      headerClassName: "text-right",
      render: (r) => `${r.priceSubcontractor ?? 0} kr`,
    },
  ];

  const columnsToRender = visibleColumns?.length
    ? allColumns.filter((col) => visibleColumns.includes(col.key))
    : allColumns;

  const allChecked =
    rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  const toggleAll = () => {
    if (allChecked) {
      const visible = new Set(rows.map((r) => r.id));
      onSelectedIdsChange(selectedIds.filter((id) => !visible.has(id)));
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

  const showCheckboxes = userView === "admin";

  return (
    <section>
      <div className="px-2 py-2 text-xs text-neutral-600">
        Showing {rows.length} of {total}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-max table-auto border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-logoblue text-white divide-x divide-neutral-300">
              {showCheckboxes && (
                <Th className="w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="h-4 w-4"
                    aria-label="Select all"
                  />
                </Th>
              )}

              {columnsToRender.map((col) => (
                <Th key={col.key} className={col.headerClassName ?? ""}>
                  {col.label}
                </Th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-300">
            {rows.map((r) => {
              const checked = selectedIds.includes(r.id);

              return (
                <tr
                  key={r.id}
                  onClick={() => onRowClick(r)}
                  className="hover:bg-neutral-50 divide-x divide-neutral-300 cursor-pointer"
                >
                  {showCheckboxes && (
                    <Td className="w-10">
                      <input
                        type="checkbox"
                        checked={checked}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleOne(r.id)}
                        className="h-4 w-4"
                        aria-label={`Select booking ${r.id}`}
                      />
                    </Td>
                  )}

                  {columnsToRender.map((col) => (
                    <Td key={col.key} className={col.className ?? ""}>
                      {col.render(r)}
                    </Td>
                  ))}
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
    <th className={`px-2 py-3 text-center font-semibold whitespace-nowrap ${className}`}>
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
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

function formatDate(iso?: string) {
  return iso || "—";
}