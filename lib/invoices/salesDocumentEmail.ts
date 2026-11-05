import { prisma } from "@/lib/db";
import { sendGmailEmail } from "@/lib/email/sendGmailEmail";
import { formatGmailSenderName, getGmailSendAsEmail } from "@/lib/email/gmailAccounts";
import { htmlToText } from "@/lib/email/htmlToText";
import { buildReplyToAddress, createOrderEmailThreadToken } from "@/lib/orders/orderEmail";
import { isS3AttachmentStorageConfigured, uploadAttachmentBufferToS3 } from "@/lib/orders/orderAttachmentStorage";

// Sends a web-sales document (a payment receipt or a refund credit note,
// paymentReceipts.ts / refundCreditNotes.ts) to the customer: the PDF is kept
// in S3, the email goes out in the order's Gmail thread and is logged on the
// order like any other outbound email. Throws when the email can't be sent.

export type SalesDocumentOrder = {
  orderNumber: string | null;
  email: string;
  customerName: string | null;
  customerLabel: string | null;
  emailThreadToken: string | null;
};

export async function emailSalesDocument(input: {
  orderId: string;
  companyId: string;
  order: SalesDocumentOrder;
  subject: string;
  html: string;
  filename: string;
  pdf: Buffer;
  now: Date;
}): Promise<{ pdfKey: string | null }> {
  const { order } = input;
  const pdfKey = isS3AttachmentStorageConfigured()
    ? (
        await uploadAttachmentBufferToS3({
          bytes: input.pdf,
          scope: `receipts/${input.orderId}`,
          filename: input.filename,
          contentType: "application/pdf",
        })
      ).storagePath
    : null;

  const threadToken = order.emailThreadToken || createOrderEmailThreadToken();
  const recipientName = order.customerName ?? order.customerLabel ?? undefined;
  const sent = await sendGmailEmail({
    to: { email: order.email, name: recipientName },
    threadToken,
    subject: input.subject,
    html: input.html,
    text: htmlToText(input.html),
    replyTo: buildReplyToAddress(threadToken),
    orderId: input.orderId,
    orderNumber: order.orderNumber ?? null,
    direction: "outbound",
    attachments: [{ filename: input.filename, contentType: "application/pdf", content: input.pdf }],
  });

  await prisma.orderEmailMessage.create({
    data: {
      orderId: input.orderId,
      companyId: input.companyId,
      direction: "OUTBOUND",
      status: sent.syncWarning ? "SENT_WITH_SYNC_WARNING" : "SENT",
      source: "GMAIL",
      externalMessageId: sent.messageId,
      gmailMessageId: sent.gmailMessageId,
      gmailThreadId: sent.gmailThreadId,
      subject: input.subject,
      bodyHtml: input.html,
      fromEmail: getGmailSendAsEmail(),
      fromName: formatGmailSenderName(),
      toEmail: order.email,
      toName: recipientName ?? null,
      sentAt: input.now,
    },
    select: { id: true },
  });
  await prisma.order.update({
    where: { id: input.orderId },
    data: { lastOutboundEmailAt: input.now, ...(order.emailThreadToken ? {} : { emailThreadToken: threadToken }) },
  });

  return { pdfKey };
}
