import { NextResponse } from "next/server";
import { authorizeWebsiteOrderAdmin } from "@/lib/orders/websiteOrderAdminAccess";
import { parseReportMonth } from "@/lib/invoices/webSalesReport";
import { loadWebSalesReport } from "@/lib/invoices/webSalesReportData";
import { buildWebSalesWorkbook, webSalesReportFilename } from "@/lib/invoices/webSalesWorkbook";

// GET ?month=YYYY-MM: the monthly web-sales report (receipts and credit notes
// in the W-series, with Stripe payouts) as an Excel file for the accountant —
// lib/invoices/webSalesReport.ts. Website-order admins of the active company.

export async function GET(req: Request) {
  const auth = await authorizeWebsiteOrderAdmin(req);
  if (!auth.ok) return auth.response;

  const month = parseReportMonth(new URL(req.url).searchParams.get("month"));
  if (!month) return NextResponse.json({ ok: false, reason: "INVALID_MONTH" }, { status: 400 });

  const { report, stripeUnavailable } = await loadWebSalesReport({ companyId: auth.companyId, month });
  const bytes = await buildWebSalesWorkbook(report, { createdAt: new Date(), stripeUnavailable });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${webSalesReportFilename(month.month)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
