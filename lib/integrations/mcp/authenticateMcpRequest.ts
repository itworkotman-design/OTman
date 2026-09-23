import { createHash, timingSafeEqual } from "node:crypto";

export type McpServiceAuthenticationResult =
  | { ok: true; companyId: string }
  | {
      ok: false;
      status: 401 | 403 | 503;
      reason: "UNAUTHORIZED" | "FORBIDDEN" | "SERVICE_NOT_CONFIGURED";
    };

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function getBearerToken(request: Request): string | null {
  const match = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i);
  return match?.[1] ?? null;
}

export function authenticateMcpRequest(
  request: Request,
): McpServiceAuthenticationResult {
  const expectedApiKey = process.env.OTMAN_API_KEY?.trim();
  const configuredCompanyId = process.env.OTMAN_API_COMPANY_ID?.trim();

  if (!expectedApiKey || expectedApiKey.length < 32 || !configuredCompanyId) {
    return {
      ok: false,
      status: 503,
      reason: "SERVICE_NOT_CONFIGURED",
    };
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
