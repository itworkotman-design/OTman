import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSmsAdmin } from "@/lib/sms/smsAccess";
import { sendOrderSms } from "@/lib/sms/sendOrderSms";
import { isSmsConfigured } from "@/lib/sms/gatewayApi";
import { buildSmsTemplateVariables, renderOrderSms, sortSmsTemplates } from "@/lib/sms/templates";
import { ORDER_SMS_SELECT, SMS_CLIENT_ERROR_REASONS } from "@/lib/sms/orderSmsFields";

type OrderSmsRouteParams = {
  params: Promise<{ orderId: string }>;
};

async function loadOrder(orderId: string, companyId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, companyId },
    select: ORDER_SMS_SELECT,
  });
}

export async function GET(req: Request, { params }: OrderSmsRouteParams) {
  const access = await requireSmsAdmin(req);
  if (!access.ok) return access.response;

  const { orderId } = await params;
  const order = await loadOrder(orderId, access.companyId);
  if (!order) {
    return NextResponse.json({ ok: false, reason: "ORDER_NOT_FOUND" }, { status: 404 });
  }

  const [messages, templates] = await Promise.all([
    prisma.orderSmsMessage.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        status: true,
        providerStatus: true,
        errorMessage: true,
        toPhone: true,
        body: true,
        createdAt: true,
        sentAt: true,
        statusUpdatedAt: true,
        sentByMembership: { select: { user: { select: { username: true, email: true } } } },
      },
    }),
    // Automatic templates are offered too, so their text can also be sent by
    // hand (e.g. resending the delivery-day SMS).
    prisma.smsTemplate.findMany({
      where: { companyId: access.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, body: true, kind: true, enabled: true },
    }),
  ]);

  const phoneOptions = [
    { label: "Phone", phone: order.phone?.trim() ?? "" },
    { label: "Phone 2", phone: order.phoneTwo?.trim() ?? "" },
  ].filter((option) => option.phone);

  return NextResponse.json({
    ok: true,
    configured: isSmsConfigured(),
    messages,
    phoneOptions,
    templates: sortSmsTemplates(templates),
    variables: buildSmsTemplateVariables(order),
  });
}

export async function POST(req: Request, { params }: OrderSmsRouteParams) {
  const access = await requireSmsAdmin(req);
  if (!access.ok) return access.response;

  const { orderId } = await params;
  const order = await loadOrder(orderId, access.companyId);
  if (!order) {
    return NextResponse.json({ ok: false, reason: "ORDER_NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const to = typeof body?.to === "string" ? body.to : "";
  const message = typeof body?.message === "string" ? body.message : "";

  const result = await sendOrderSms({
    order: { id: order.id, companyId: order.companyId },
    toPhone: to,
    body: renderOrderSms(message, order),
    kind: "MANUAL",
    actor: access.actor,
  });

  if (result.ok) {
    return NextResponse.json({ ok: true, messageId: result.messageId });
  }

  const status = SMS_CLIENT_ERROR_REASONS.has(result.reason) ? 400 : result.reason === "SMS_NOT_CONFIGURED" ? 503 : 502;
  return NextResponse.json({ ok: false, reason: result.reason }, { status });
}
