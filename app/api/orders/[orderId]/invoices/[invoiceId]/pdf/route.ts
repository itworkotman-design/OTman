import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeWebsiteOrderAdmin } from "@/lib/orders/websiteOrderAdminAccess";
import { downloadAttachmentFromS3 } from "@/lib/orders/orderAttachmentStorage";
import { invoiceFilename } from "@/lib/invoices/invoiceDocument";

// A faktura's PDF exactly as it was sent (OrderInvoice.pdfKey) — the Payment
// tab's View (inline) and Download (?download=1).

type Params = { params: Promise<{ orderId: string; invoiceId: string }> };

export async function GET(req: Request, { params }: Params) {
  const auth = await authorizeWebsiteOrderAdmin(req);
  if (!auth.ok) return auth.response;
  const { orderId, invoiceId } = await params;

  const invoice = await prisma.orderInvoice.findFirst({
    where: { id: invoiceId, orderId, companyId: auth.companyId },
    select: { invoiceNumber: true, kind: true, pdfKey: true },
  });
  if (!invoice?.pdfKey) return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });

  const file = await downloadAttachmentFromS3(invoice.pdfKey).catch(() => null);
  if (!file) return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });

  const download = new URL(req.url).searchParams.get("download") === "1";
  const filename = invoiceFilename(invoice.kind === "refund" ? "refund" : "invoice", invoice.invoiceNumber);
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
