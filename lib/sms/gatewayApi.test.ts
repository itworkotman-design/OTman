import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  isSmsConfigured,
  mapGatewayApiStatus,
  sendGatewayApiSms,
  verifyGatewayApiSignature,
} from "./gatewayApi";

const ENV_KEYS = ["GATEWAYAPI_TOKEN", "GATEWAYAPI_SENDER", "GATEWAYAPI_BASE_URL"] as const;

describe("gatewayApi", () => {
  const original: Record<string, string | undefined> = {};
  const fetchMock = vi.fn();

  beforeEach(() => {
    for (const key of ENV_KEYS) original[key] = process.env[key];
    process.env.GATEWAYAPI_TOKEN = "tok-123";
    delete process.env.GATEWAYAPI_SENDER;
    delete process.env.GATEWAYAPI_BASE_URL;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    vi.unstubAllGlobals();
  });

  it("isSmsConfigured reflects the token env var", () => {
    expect(isSmsConfigured()).toBe(true);
    delete process.env.GATEWAYAPI_TOKEN;
    expect(isSmsConfigured()).toBe(false);
  });

  it("posts a single message to the EU endpoint with token auth", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ msg_id: "01ABC", recipient: 4740284977, reference: "ref-1" }), { status: 202 }),
    );

    const result = await sendGatewayApiSms({ recipient: "4740284977", message: "Hei", reference: "ref-1" });

    expect(result).toEqual({ msgId: "01ABC" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://messaging.gatewayapi.eu/mobile/single");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Token tok-123", "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ sender: "Otman", recipient: 4740284977, message: "Hei", reference: "ref-1" });
  });

  it("uses the configured sender and base url", async () => {
    process.env.GATEWAYAPI_SENDER = "OtmanAS";
    process.env.GATEWAYAPI_BASE_URL = "https://messaging.gatewayapi.com/";
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ msg_id: "x" }), { status: 202 }));

    await sendGatewayApiSms({ recipient: "4740284977", message: "Hei" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://messaging.gatewayapi.com/mobile/single");
    expect(JSON.parse(init.body).sender).toBe("OtmanAS");
  });

  it("throws with the provider's error detail on a non-2xx response", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: [{ msg: "Invalid recipient" }] }), { status: 422 }),
    );

    await expect(sendGatewayApiSms({ recipient: "4740284977", message: "Hei" })).rejects.toThrow(/422.*Invalid recipient/);
  });

  it("throws when not configured, without calling the API", async () => {
    delete process.env.GATEWAYAPI_TOKEN;
    await expect(sendGatewayApiSms({ recipient: "4740284977", message: "Hei" })).rejects.toThrow(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("verifyGatewayApiSignature", () => {
  const body = '{"event_type":"message.status.sms"}';
  const sign = (secret: string) => `v1=${createHmac("sha256", secret).update(body).digest("hex")}`;

  it("accepts a valid v1 HMAC-SHA256 signature of the raw body", () => {
    expect(verifyGatewayApiSignature(body, sign("s3cret"), "s3cret")).toBe(true);
  });

  it("rejects a wrong secret, a tampered body, or a missing header", () => {
    expect(verifyGatewayApiSignature(body, sign("other"), "s3cret")).toBe(false);
    expect(verifyGatewayApiSignature(`${body} `, sign("s3cret"), "s3cret")).toBe(false);
    expect(verifyGatewayApiSignature(body, null, "s3cret")).toBe(false);
    expect(verifyGatewayApiSignature(body, "v1=zz", "s3cret")).toBe(false);
  });
});

describe("mapGatewayApiStatus", () => {
  it("maps provider delivery states to app statuses", () => {
    expect(mapGatewayApiStatus("DELIVERED")).toBe("DELIVERED");
    expect(mapGatewayApiStatus("ACCEPTED")).toBe("DELIVERED");
    for (const state of ["EXPIRED", "UNDELIVERABLE", "REJECTED", "SKIPPED"]) {
      expect(mapGatewayApiStatus(state)).toBe("FAILED");
    }
    for (const state of ["ENROUTE", "SCHEDULED", "BUFFERED", "UNKNOWN", "whatever"]) {
      expect(mapGatewayApiStatus(state)).toBe("SENT");
    }
  });
});
