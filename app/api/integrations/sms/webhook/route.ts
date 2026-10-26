import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mapGatewayApiStatus, verifyGatewayApiSignature } from "@/lib/sms/gatewayApi";

type SmsStatusEvent = {
  msg_id?: unknown;
  reference?: unknown;
  status?: unknown;
  status_at?: unknown;
  error?: { hex_code?: unknown; details?: unknown } | null;
};

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function describeError(error: SmsStatusEvent["error"]) {
  if (!error || typeof error !== "object") return null;
  const details = asString(error.details);
  const code = asString(error.hex_code);
  if (details && code) return `${details} (${code})`;
  return details ?? code;
}

// GatewayAPI delivery status webhook (Mobile Messaging API). Configure it in
// the GatewayAPI dashboard pointing at /api/integrations/sms/webhook with a
// secret equal to GATEWAYAPI_WEBHOOK_SECRET. GatewayAPI retries non-2xx
// responses for 24h, so anything we can't use is acknowledged with 200.
export async function POST(req: Request) {
  const secret = process.env.GATEWAYAPI_WEBHOOK_SECRET?.trim() ?? "";
  const rawBody = await req.text();

  if (!verifyGatewayApiSignature(rawBody, req.headers.get("signature"), secret)) {
    return NextResponse.json({ ok: false, reason: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let payload: { event_type?: unknown; event?: SmsStatusEvent } | null = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, reason: "INVALID_JSON" }, { status: 400 });
  }

  if (payload?.event_type !== "message.status.sms" || !payload.event) {
    return NextResponse.json({ ok: true, ignored: "EVENT_TYPE" });
  }

  const event = payload.event;
  const msgId = asString(event.msg_id);
  const reference = asString(event.reference);
  const providerStatus = asString(event.status);

  if (!providerStatus || (!msgId && !reference)) {
    return NextResponse.json({ ok: true, ignored: "INCOMPLETE_EVENT" });
  }

  const message = await prisma.orderSmsMessage.findFirst({
    where: {
      OR: [...(msgId ? [{ externalMessageId: msgId }] : []), ...(reference ? [{ id: reference }] : [])],
    },
    select: { id: true, statusUpdatedAt: true },
  });

  if (!message) {
    return NextResponse.json({ ok: true, ignored: "UNKNOWN_MESSAGE" });
  }

  const statusAtRaw = asString(event.status_at);
  const parsedStatusAt = statusAtRaw ? new Date(statusAtRaw) : new Date();
  const statusAt = Number.isNaN(parsedStatusAt.getTime()) ? new Date() : parsedStatusAt;

  // Events can arrive out of order (e.g. a retried ENROUTE after DELIVERED).
  if (message.statusUpdatedAt && statusAt < message.statusUpdatedAt) {
    return NextResponse.json({ ok: true, ignored: "STALE_EVENT" });
  }

  const status = mapGatewayApiStatus(providerStatus);
  const errorMessage = describeError(event.error);

  await prisma.orderSmsMessage.update({
    where: { id: message.id },
    data: {
      status,
      providerStatus,
      statusUpdatedAt: statusAt,
      ...(msgId ? { externalMessageId: msgId } : {}),
      ...(errorMessage ? { errorMessage } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
