import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeWebsiteOrderAdmin } from "@/lib/orders/websiteOrderAdminAccess";
import { downloadAttachmentFromS3 } from "@/lib/orders/orderAttachmentStorage";
import { CREDIT_NOTE_REFUND_SELECT, creditNoteForRefund, sendRefundCreditNote } from "@/lib/invoices/refundCreditNotes";
import { receiptFilename, receiptSellerFromEnv } from "@/lib/invoices/receiptDocument";
import { renderReceiptPdf } from "@/lib/invoices/receiptPdf";
import { formatReceiptNumber } from "@/lib/invoices/receiptSeries";

// A Stripe refund's credit note (lib/invoices/refundCreditNotes.ts) for the
// Payment tab. GET: the PDF as sent (S3), drawn again when no stored copy can
// be read; ?download=1 downloads it. POST: email it to the customer (again).

type Params = { params: Promise<{ orderId: string; refundId: string }> };

async function findRefund(companyId: string, orderId: string, refundId: string) {
  return prisma.orderRefund.findFirst({ where: { id: refundId, orderId, companyId }, select: CREDIT_NOTE_REFUND_SELECT });
}

export async function GET(req: Request, { params }: Params) {
  const auth = await authorizeWebsiteOrderAdmin(req);
  if (!auth.ok) return auth.response;
  const { orderId, refundId } = await params;

  const refund = await findRefund(auth.companyId, orderId, refundId);
  if (!refund?.receiptNumber) return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });

  let bytes: Uint8Array | null = null;
  if (refund.receiptPdfKey) {
    const file = await downloadAttachmentFromS3(refund.receiptPdfKey).catch(() => null);
    if (file) bytes = new Uint8Array(file.bytes);
  }
  if (!bytes) {
    const seller = receiptSellerFromEnv();
    if (!seller) return NextResponse.json({ ok: false, reason: "SETTINGS_MISSING" }, { status: 404 });
    bytes = await renderReceiptPdf(creditNoteForRefund(refund, refund.receiptNumber, seller));
  }

  const download = new URL(req.url).searchParams.get("download") === "1";
  const filename = receiptFilename(formatReceiptNumber(refund.receiptNumber), "creditNote");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await authorizeWebsiteOrderAdmin(req);
  if (!auth.ok) return auth.response;
  const { orderId, refundId } = await params;

  const refund = await findRefund(auth.companyId, orderId, refundId);
  if (!refund) return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });

  const result = await sendRefundCreditNote({ refundId: refund.id, resend: true });
  if (!result.ok) return NextResponse.json(result, { status: 422 });
  return NextResponse.json(result);
}
