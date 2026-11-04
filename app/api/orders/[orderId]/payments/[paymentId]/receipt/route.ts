import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeWebsiteOrderAdmin } from "@/lib/orders/websiteOrderAdminAccess";
import { downloadAttachmentFromS3 } from "@/lib/orders/orderAttachmentStorage";
import { RECEIPT_PAYMENT_SELECT, receiptForPayment, sendPaymentReceipt } from "@/lib/invoices/paymentReceipts";
import { receiptFilename, receiptSellerFromEnv } from "@/lib/invoices/receiptDocument";
import { renderReceiptPdf } from "@/lib/invoices/receiptPdf";

// A Stripe payment's receipt (lib/invoices/paymentReceipts.ts) for the Payment
// tab. GET: the PDF as sent (S3), drawn again when no stored copy can be read;
// ?download=1 downloads it. POST: email it to the customer again.

type Params = { params: Promise<{ orderId: string; paymentId: string }> };

async function findPayment(companyId: string, orderId: string, paymentId: string) {
  return prisma.orderPayment.findFirst({ where: { id: paymentId, orderId, companyId }, select: RECEIPT_PAYMENT_SELECT });
}

export async function GET(req: Request, { params }: Params) {
  const auth = await authorizeWebsiteOrderAdmin(req);
  if (!auth.ok) return auth.response;
  const { orderId, paymentId } = await params;

  const payment = await findPayment(auth.companyId, orderId, paymentId);
  if (!payment?.receiptNumber) return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });

  let bytes: Uint8Array | null = null;
  if (payment.receiptPdfKey) {
    const file = await downloadAttachmentFromS3(payment.receiptPdfKey).catch(() => null);
    if (file) bytes = new Uint8Array(file.bytes);
  }
  if (!bytes) {
    const seller = receiptSellerFromEnv();
    if (!seller) return NextResponse.json({ ok: false, reason: "SETTINGS_MISSING" }, { status: 404 });
    bytes = await renderReceiptPdf(receiptForPayment(payment, payment.receiptNumber, seller));
  }

  const download = new URL(req.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${receiptFilename(String(payment.receiptNumber))}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await authorizeWebsiteOrderAdmin(req);
  if (!auth.ok) return auth.response;
  const { orderId, paymentId } = await params;

  const payment = await findPayment(auth.companyId, orderId, paymentId);
  if (!payment) return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });

  const result = await sendPaymentReceipt({ paymentId: payment.id, resend: true });
  if (!result.ok) return NextResponse.json(result, { status: 422 });
  return NextResponse.json(result);
}
