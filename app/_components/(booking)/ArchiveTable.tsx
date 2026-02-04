"use client";

import { useMemo, useState } from "react";

/**
 * TODO: Replace example data with DB fetch:
 * - server action / API route
 * - pagination (page + rowsPerPage)
 * - filters (status/client/sub/date range/search)
 */

type BookingRow = {
  id: number;
  status: string;
  deliveryDate: string; // YYYY-MM-DD
  timeWindow: string; // "16:00 - 21:00"
  customer: string;
  orderNo: string;
  name: string;
  phone: string;
  pickupAddress: string;
  extraPickup: string;
  deliveryAddress: string;
  returnAddress: string;
  products: string;
  deliveryType: string;
  monitoringReturn: string;
  description: string;
  cashierName: string;
  cashierPhone: string;
  customerNotes: string;
  driverInfo: string;
  orderDate: string; // YYYY-MM-DD
  lastEdited: string; // YYYY-MM-DD HH:mm
  priceExVat: number;
  priceSubcontractor: number;
};

const EXAMPLE_ROWS: BookingRow[] = [
  {
    id: 13205,
    status: "Confirmed",
    deliveryDate: "2026-03-02",
    timeWindow: "16:00 - 21:00",
    customer: "POWER Rud",
    orderNo: "41254801",
    name: "RADJI GAMACHIS Aga",
    phone: "41254801",
    pickupAddress: "POWER Rud, Løxaveien 5, 1351 Rud, Norway",
    extraPickup: "",
    deliveryAddress: "Haganjordet 10, 1351 Rud, Norway",
    returnAddress: "",
    products: "Komfyr, Kjøleskap, Kombiskap, TV",
    deliveryType: "Innbæring",
    monitoringReturn:
      "Montering skap til komfyr. Montering av frittstående skap. Montering av TV over 55\" på vegg. Type vegg: Betong",
    description:
      "Montering av komfyr (stikk kontakt) og kombiskap. Montering av TV på vegg og oppkobling av lydplanke til TV.",
    cashierName: "Talha",
    cashierPhone: "+4797637698",
    customerNotes: "Etasje: 1",
    driverInfo:
      "Driver notes: 2026-02-03 18:55:15 — (canceled + assignment wrongfully put in gsm 2026-02-03 18:55:15 — (canceled + pick_up) wrongfully put in gsm",
    orderDate: "2026-01-30",
    lastEdited: "2026-02-03 13:20",
    priceExVat: 4053,
    priceSubcontractor: 2099,
  },
  {
    id: 12905,
    status: "Confirmed",
    deliveryDate: "2026-03-04",
    timeWindow: "06:00 - 09:00",
    customer: "POWER SkiADADADAD ADADADAD",
    orderNo: "11351276491",
    name: "Florentina",
    phone: "94849140",
    pickupAddress: "POWER Ski, Exampleveien 1, 1400 Ski, Norway",
    extraPickup: "",
    deliveryAddress: "Hasselkrakken 22, 1400 Ski, Norway",
    returnAddress: "",
    products: "Kjøleskap / Kombiskap",
    deliveryType: "Innbæring",
    monitoringReturn: "",
    description: "Hjemlevering med innbæring.",
    cashierName: "fredrik",
    cashierPhone: "+4791182731",
    customerNotes: "",
    driverInfo: "",
    orderDate: "2026-01-24",
    lastEdited: "2026-01-24 15:47",
    priceExVat: 669,
    priceSubcontractor: 450,
  },
];

type ArchiveTableProps = {
  rowsPerPage?: number;
  onRowClick?: (row: BookingRow) => void;
};

export function ArchiveTable({ rowsPerPage = 25, onRowClick }: ArchiveTableProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // TODO: Replace with fetched data + paging
  const rows = useMemo(() => EXAMPLE_ROWS.slice(0, rowsPerPage), [rowsPerPage]);

  const allChecked = rows.length > 0 && selectedIds.length === rows.length;

  const toggleAll = () => {
    if (allChecked) setSelectedIds([]);
    else setSelectedIds(rows.map((r) => r.id));
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  
  return (
    <section className="border border-b-gray-200">
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
              <Th className="w-22.5">Time<br/>window</Th>
              <Th className="w-25">Customer</Th>
              <Th className="">Order no.</Th>
              <Th className="w-25">Name</Th>
              <Th>Phone</Th>
              <Th className="w-25">Pickup<br/>address</Th>
              <Th className="w-25">Extra<br/>pickup</Th>
              <Th className="w-25">Delivery<br/>address</Th>
              <Th className="w-25">Return<br/>address</Th>
              <Th className="w-50">Products</Th>
              <Th>Delivery<br/>type</Th>
              <Th className="w-50">Monitoring/ return</Th>
              <Th className="w-50">Description</Th>
              <Th>Cashier name</Th>
              <Th>Cashier phone</Th>
              <Th className="max-w-50">Customer <br/> notes</Th>
              <Th className="w-50">Driver info</Th>
              <Th>Order date</Th>
              <Th>Last edited</Th>
              <Th className="text-right">Price ex<br/> VAT</Th>
              <Th className="text-right">Price <br/> subcontractor</Th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-300">
            {rows.map((r) => {
              const checked = selectedIds.includes(r.id);
              return (
                <tr key={r.id} className="hover:bg-neutral-50 divide-x divide-neutral-300">
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
                  <Td >{r.status}</Td>
                  <Td className="whitespace-nowrap">{formatDate(r.deliveryDate)}</Td>
                  <Td className="whitespace-nowrap">{r.timeWindow}</Td>
                  <Td >{r.customer}</Td>
                  <Td className="whitespace-nowrap">{r.orderNo}</Td>
                  <Td >{r.name}</Td>
                  <Td className="whitespace-nowrap">{r.phone}</Td>

                  <Td>{r.pickupAddress}</Td>
                  <Td>{r.extraPickup || "—"}</Td>
                  <Td>{r.deliveryAddress}</Td>
                  <Td>{r.returnAddress || "—"}</Td>
                  <Td>{r.products}</Td>
                  <Td>{r.deliveryType}</Td>
                  <Td>{r.monitoringReturn || "—"}</Td>
                  <Td>{r.description || "—"}</Td>

                  <Td>{r.cashierName || "—"}</Td>
                  <Td className="whitespace-nowrap ">{r.cashierPhone || "—"}</Td>
                  <Td >{r.customerNotes || "—"}</Td>
                  <Td>{r.driverInfo || "—"}</Td>

                  <Td>{formatDate(r.orderDate)}</Td>
                  <Td>{r.lastEdited}</Td>

                  <Td className=" text-right">{formatMoney(r.priceExVat)}</Td>
                  <Td className=" text-right">
                    {formatMoney(r.priceSubcontractor)}
                  </Td>

                  {/* Optional row click target */}
                  <td className="hidden">
                    <button type="button" onClick={() => onRowClick?.(r)} />
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

/* ---------- tiny helpers ---------- */

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
    <td
      className={`px-3 py-2 align-top ${className}`}
    >
      {children}
    </td>
  );
}



function formatDate(iso: string) {
  // keep simple; switch to locale formatting if you want
  return iso;
}

function formatMoney(n: number) {
  // simple formatting; replace with Intl.NumberFormat if desired
  return n.toString();
}
