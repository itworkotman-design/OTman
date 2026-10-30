import type { OrderSmsKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isSmsConfigured, sendGatewayApiSms } from "@/lib/sms/gatewayApi";
import { normalizeSmsRecipient } from "@/lib/sms/phone";
import { createOrderActionEvent, type OrderEventActor } from "@/lib/orders/orderEvents";

export type SendOrderSmsResult =
  | { ok: true; messageId: string }
  | { ok: false; reason: string; messageId?: string };

const KIND_LABELS: Record<OrderSmsKind, string> = {
  MANUAL: "Manual SMS",
  DAY_BEFORE_DELIVERY: "Automatic day-before-delivery SMS",
  REVIEW_REQUEST: "Automatic review request SMS",
};

function toErrorMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

// Shared by the per-order composer, the bulk "send SMS to selected" route and
// the 19:00 day-before sweep. The OrderSmsMessage row is written before the API call and
// its id is the GatewayAPI `reference`, so the status webhook can always find
// it. Failures are logged on the row (shown in the order's SMS tab) rather
// than thrown.
export async function sendOrderSms(params: {
  order: { id: string; companyId: string };
  toPhone: string | null | undefined;
  body: string;
  kind: OrderSmsKind;
  actor: OrderEventActor;
}): Promise<SendOrderSmsResult> {
  const { order, kind, actor } = params;
  const body = params.body.trim();
  const rawPhone = params.toPhone?.trim() ?? "";

  if (!body) return { ok: false, reason: "EMPTY_MESSAGE" };
  if (!rawPhone) return { ok: false, reason: "MISSING_PHONE" };
  if (!isSmsConfigured()) return { ok: false, reason: "SMS_NOT_CONFIGURED" };

  const recipient = normalizeSmsRecipient(rawPhone);

  const row = await prisma.orderSmsMessage.create({
    data: {
      orderId: order.id,
      companyId: order.companyId,
      kind,
      status: recipient ? "SENT" : "FAILED",
      toPhone: recipient ?? rawPhone,
      body,
      sentByMembershipId: actor.membershipId ?? null,
      errorMessage: recipient ? null : "Invalid phone number",
    },
    select: { id: true },
  });

  const logEvent = (title: string, extra: string[] = []) =>
    createOrderActionEvent(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      actor,
      title,
      details: [`To: ${recipient ?? rawPhone}`, KIND_LABELS[kind], ...extra],
    });

  if (!recipient) {
    await logEvent("SMS failed", ["Reason: Invalid phone number"]);
    return { ok: false, messageId: row.id, reason: "INVALID_PHONE" };
  }

  try {
    const { msgId } = await sendGatewayApiSms({ recipient, message: body, reference: row.id });
    // statusUpdatedAt is left for the status webhook, which orders events by
    // GatewayAPI's own status_at timestamps.
    await prisma.orderSmsMessage.update({
      where: { id: row.id },
      data: { externalMessageId: msgId, sentAt: new Date() },
    });
    await logEvent("SMS sent");
    return { ok: true, messageId: row.id };
  } catch (error) {
    const reason = toErrorMessage(error);
    await prisma.orderSmsMessage.update({
      where: { id: row.id },
      data: { status: "FAILED", errorMessage: reason, statusUpdatedAt: new Date() },
    });
    await logEvent("SMS failed", [`Reason: ${reason}`]);
    return { ok: false, messageId: row.id, reason };
  }
}
