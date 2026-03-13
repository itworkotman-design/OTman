import XLSXStyle from "xlsx-js-style";
import type { OrderRow } from "@/lib/_mockdb";

const HEADERS: { key: keyof OrderRow; label: string; width: number }[] = [
  { key: "id",                label: "ID",                 width: 10 },
  { key: "status",            label: "Status",             width: 15 },
  { key: "deliveryDate",      label: "Delivery Date",      width: 15 },
  { key: "timeWindow",        label: "Time Window",        width: 15 },
  { key: "customer",          label: "Customer",           width: 20 },
  { key: "orderNo",           label: "Order No.",          width: 15 },
  { key: "name",              label: "Name",               width: 20 },
  { key: "phone",             label: "Phone",              width: 15 },
  { key: "pickupAddress",     label: "Pickup Address",     width: 25 },
  { key: "extraPickup",       label: "Extra Pickup",       width: 25 },
  { key: "deliveryAddress",   label: "Delivery Address",   width: 25 },
  { key: "returnAddress",     label: "Return Address",     width: 25 },
  { key: "products",          label: "Products",           width: 30 },
  { key: "deliveryType",      label: "Delivery Type",      width: 15 },
  { key: "monitoringOrReturn",label: "Monitoring/Return",  width: 25 },
  { key: "description",       label: "Description",        width: 30 },
  { key: "cashierName",       label: "Cashier Name",       width: 20 },
  { key: "cashierPhone",      label: "Cashier Phone",      width: 15 },
  { key: "customerNotes",     label: "Customer Notes",     width: 30 },
  { key: "driverInfo",        label: "Driver Info",        width: 30 },
  { key: "orderDate",         label: "Order Date",         width: 15 },
  { key: "lastEdited",        label: "Last Edited",        width: 15 },
  { key: "priceExVat",        label: "Price ex VAT",       width: 15 },
  { key: "subcontractor",     label: "Subcontractor",      width: 20 },
];

const HEADER_STYLE = {
  font:      { bold: true, color: { rgb: "FFFFFF" } },
  fill:      { fgColor: { rgb: "273097" } },
  alignment: { horizontal: "center", vertical: "center" },
  border: {
    bottom: { style: "thin", color: { rgb: "CCCCCC" } },
  },
};

const ROW_STYLE = {
  font:      { color: { rgb: "333333" } },
  alignment: { vertical: "top", wrapText: true },
};

const ALT_ROW_STYLE = {
  ...ROW_STYLE,
  fill: { fgColor: { rgb: "F5F7FA" } },
};

export function exportOrdersToExcel(rows: OrderRow[], filename = "orders.xlsx") {
  const ws: XLSXStyle.WorkSheet = {};

  // Header row
  HEADERS.forEach((col, colIdx) => {
    const cellRef = XLSXStyle.utils.encode_cell({ r: 0, c: colIdx });
    ws[cellRef] = { v: col.label, t: "s", s: HEADER_STYLE };
  });

  // Data rows
  rows.forEach((row, rowIdx) => {
    const style = rowIdx % 2 === 0 ? ROW_STYLE : ALT_ROW_STYLE;

    HEADERS.forEach((col, colIdx) => {
      const cellRef = XLSXStyle.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
      const raw = row[col.key];
      const value = Array.isArray(raw)
        ? raw.join(", ")
        : (raw ?? "");

      ws[cellRef] = { v: value, t: "s", s: style };
    });
  });

  // Set sheet range
  ws["!ref"] = XLSXStyle.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rows.length, c: HEADERS.length - 1 },
  });

  // Column widths
  ws["!cols"] = HEADERS.map((col) => ({ wch: col.width }));
  // Column heights
  ws["!rows"] = [{ hpt: 30 }];

  // Freeze header row
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, "Orders");
  XLSXStyle.writeFile(wb, filename);
}