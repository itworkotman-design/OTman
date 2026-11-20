import { createHash, timingSafeEqual } from "node:crypto";

export type ServiceAuthenticationResult =
  | { ok: true; companyId: string }
  | {
      ok: false;
      status: 401 | 403 | 503;
      reason: "UNAUTHORIZED" | "FORBIDDEN" | "SERVICE_NOT_CONFIGURED";
    };

const MIN_API_KEY_LENGTH = 32;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function getBearerToken(request: Request): string | null {
  const match = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i);
  return match?.[1] ?? null;
}

/**
 * Server-to-server authentication shared by the integration APIs (MCP,
 * accounting): a bearer key compared in constant time, plus the fixed company
 * in `X-Otman-Company-Id`. Each integration passes its own key so one can be
 * revoked without the other. Missing or short configuration fails closed (503).
 */
export function authenticateServiceRequest(
  request: Request,
  config: { apiKey: string | undefined; companyId: string | undefined },
): ServiceAuthenticationResult {
  const expectedApiKey = config.apiKey?.trim();
  const configuredCompanyId = config.companyId?.trim();

  if (!expectedApiKey || expectedApiKey.length < MIN_API_KEY_LENGTH || !configuredCompanyId) {
    return { ok: false, status: 503, reason: "SERVICE_NOT_CONFIGURED" };
  }

  const providedApiKey = getBearerToken(request) ?? "";

  if (!timingSafeEqual(digest(providedApiKey), digest(expectedApiKey))) {
    return { ok: false, status: 401, reason: "UNAUTHORIZED" };
  }

  if (request.headers.get("x-otman-company-id") !== configuredCompanyId) {
    return { ok: false, status: 403, reason: "FORBIDDEN" };
  }

  return { ok: true, companyId: configuredCompanyId };
}
