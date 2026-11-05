import { NextResponse } from "next/server";
import { authorizeWebsiteOrderAdmin } from "@/lib/orders/websiteOrderAdminAccess";
import { parseReportPeriod } from "@/lib/invoices/webSalesReport";
import { loadWebSalesReport } from "@/lib/invoices/webSalesReportData";
import { buildWebSalesWorkbook, webSalesReportFilename } from "@/lib/invoices/webSalesWorkbook";
import { renderWebSalesReportPdf } from "@/lib/invoices/webSalesReportPdf";

// GET ?month=YYYY-MM or ?date=YYYY-MM-DD, &format=pdf for a PDF (Excel
// otherwise): the web-sales report (receipts and credit notes in the
// W-series, with Stripe payouts) for the accountant —
// lib/invoices/webSalesReport.ts. Website-order admins of the active company.

export async function GET(req: Request) {
  const auth = await authorizeWebsiteOrderAdmin(req);
  if (!auth.ok) return auth.response;

  const params = new URL(req.url).searchParams;
  const period = parseReportPeriod({ month: params.get("month"), date: params.get("date") });
  if (!period) return NextResponse.json({ ok: false, reason: "INVALID_PERIOD" }, { status: 400 });
  const pdf = params.get("format") === "pdf";

  const { report, stripeUnavailable } = await loadWebSalesReport({ companyId: auth.companyId, period });
  const options = { createdAt: new Date(), stripeUnavailable };
  const bytes = pdf ? await renderWebSalesReportPdf(report, options) : await buildWebSalesWorkbook(report, options);

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": pdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${webSalesReportFilename(period.label, pdf ? "pdf" : "xlsx")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
