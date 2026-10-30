import { createHmac, timingSafeEqual } from "node:crypto";

// GatewayAPI Mobile Messaging API (https://gatewayapi.com/docs/message/overview/).
// EU-hosted endpoint by default; override with GATEWAYAPI_BASE_URL if the
// account lives on gatewayapi.com instead.
const DEFAULT_BASE_URL = "https://messaging.gatewayapi.eu";
// Max 11 characters for an alphanumeric sender.
const DEFAULT_SENDER = "Otman";

export type AppSmsStatus = "SENT" | "DELIVERED" | "FAILED";

export function isSmsConfigured() {
  return Boolean(process.env.GATEWAYAPI_TOKEN?.trim());
}

function getBaseUrl() {
  return (process.env.GATEWAYAPI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function describeErrorBody(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (item && typeof item === "object" ? String((item as { msg?: unknown }).msg ?? "") : String(item)))
      .filter(Boolean)
      .join("; ");
  }
  const message = (body as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

export async function sendGatewayApiSms(input: {
  recipient: string;
  message: string;
  reference?: string;
}): Promise<{ msgId: string }> {
  const token = process.env.GATEWAYAPI_TOKEN?.trim();
  if (!token) {
    throw new Error("GatewayAPI is not configured (GATEWAYAPI_TOKEN missing)");
  }

  const response = await fetch(`${getBaseUrl()}/mobile/single`, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: process.env.GATEWAYAPI_SENDER?.trim() || DEFAULT_SENDER,
      recipient: Number(input.recipient),
      message: input.message,
      ...(input.reference ? { reference: input.reference } : {}),
    }),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = describeErrorBody(body);
    throw new Error(`GatewayAPI ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const msgId = body && typeof body === "object" ? (body as { msg_id?: unknown }).msg_id : null;
  if (typeof msgId !== "string" || !msgId) {
    throw new Error("GatewayAPI response had no msg_id");
  }

  return { msgId };
}

// Webhook events carry `Signature: v1=<hex HMAC-SHA256 of the raw body>`,
// keyed with the secret configured on the webhook in the GatewayAPI dashboard.
export function verifyGatewayApiSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const provided = header.trim().replace(/^v1=/, "");
  if (!/^[0-9a-f]+$/i.test(provided)) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const providedBuffer = Buffer.from(provided.toLowerCase(), "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

// https://gatewayapi.com/docs/states/ — ACCEPTED means the operator took it on
// the handset's behalf, which is as good as delivered for us.
export function mapGatewayApiStatus(providerStatus: string): AppSmsStatus {
  switch (providerStatus.trim().toUpperCase()) {
    case "DELIVERED":
    case "ACCEPTED":
      return "DELIVERED";
    case "EXPIRED":
    case "UNDELIVERABLE":
    case "REJECTED":
    case "SKIPPED":
      return "FAILED";
    default:
      return "SENT";
  }
}
