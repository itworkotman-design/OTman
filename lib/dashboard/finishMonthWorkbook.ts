import ExcelJS from "exceljs";

export type FinishMonthWorkbookOrder = {
  displayId: number;
  orderNumber: string | null;
  createdAt: Date;
  deliveryDate: string | null;
  customerLabel: string | null;
  customerName: string | null;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  returnAddress: string | null;
  priceSubcontractor: number | null;
};

function formatDateTime(value: Date): string {
  return value.toLocaleString("no-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatText(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const trimmed = value.trim();
  return trimmed || "-";
}

export async function buildFinishMonthWorkbook(input: {
  subcontractorName: string;
  monthLabel: string;
  orders: FinishMonthWorkbookOrder[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Month summary");
  const monthSum = input.orders.reduce(
    (sum, order) => sum + Number(order.priceSubcontractor ?? 0),
    0,
  );
  const columns = [
    { header: "ID", key: "displayId", width: 12 },
    { header: "Order number", key: "orderNumber", width: 18 },
    { header: "Created at", key: "createdAt", width: 22 },
    { header: "Delivery date", key: "deliveryDate", width: 16 },
    { header: "Customer", key: "customer", width: 24 },
    { header: "Pickup address", key: "pickupAddress", width: 30 },
    { header: "Delivery address", key: "deliveryAddress", width: 30 },
    { header: "Return address", key: "returnAddress", width: 30 },
    { header: "Subcontractor sum", key: "priceSubcontractor", width: 20 },
  ] as const;

  worksheet.columns = columns.map((column) => ({
    key: column.key,
    width: column.width,
  }));

  worksheet.getCell("A1").value = "Month sum:";
  worksheet.getCell("B1").value = monthSum;
  worksheet.getCell("A2").value = "Month:";
  worksheet.getCell("B2").value = input.monthLabel;
  worksheet.getCell("A3").value = "Subcontractor:";
  worksheet.getCell("B3").value = input.subcontractorName;

  ["A1", "A2", "A3"].forEach((cellRef) => {
    worksheet.getCell(cellRef).font = { bold: true };
  });
  worksheet.getCell("B1").font = { bold: true };
  worksheet.getCell("B1").numFmt = '#,##0 "NOK"';

  const headerRowIndex = 5;
  const headerRow = worksheet.getRow(headerRowIndex);
  columns.forEach((column, index) => {
    headerRow.getCell(index + 1).value = column.header;
  });
  headerRow.height = 28;

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });

  input.orders.forEach((order) => {
    const row = worksheet.addRow({
      displayId: order.displayId,
      orderNumber: formatText(order.orderNumber),
      createdAt: formatDateTime(order.createdAt),
      deliveryDate: formatText(order.deliveryDate),
      customer: formatText(order.customerLabel || order.customerName),
      pickupAddress: formatText(order.pickupAddress),
      deliveryAddress: formatText(order.deliveryAddress),
      returnAddress: formatText(order.returnAddress),
      priceSubcontractor: Number(order.priceSubcontractor ?? 0),
    });

    row.height = 22;
    row.getCell("priceSubcontractor").numFmt = '#,##0 "NOK"';

    row.eachCell((cell) => {
      cell.alignment = {
        vertical: "top",
        horizontal: "left",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  });

  worksheet.views = [{ state: "frozen", ySplit: headerRowIndex }];
  worksheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
