import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { authenticateAccountingRequest } from "./authenticateAccountingRequest";

const ACCOUNTING_KEY = "accounting-key-with-at-least-32-characters";
const MCP_KEY = "mcp-key-with-at-least-32-characters-long";
const COMPANY_ID = "company-fixed";
const saved = { ...process.env };

function request(key: string, companyId = COMPANY_ID) {
  return new Request("http://localhost/api/integrations/accounting/stores", {
    headers: { Authorization: `Bearer ${key}`, "X-Otman-Company-Id": companyId },
  });
}

describe("authenticateAccountingRequest", () => {
  beforeEach(() => {
    process.env.ACCOUNTING_API_KEY = ACCOUNTING_KEY;
    process.env.OTMAN_API_KEY = MCP_KEY;
    process.env.OTMAN_API_COMPANY_ID = COMPANY_ID;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it("accepts the accounting key for the fixed company", () => {
    expect(authenticateAccountingRequest(request(ACCOUNTING_KEY))).toEqual({ ok: true, companyId: COMPANY_ID });
  });

  it("rejects the MCP key, so each service's key can be revoked on its own", () => {
    expect(authenticateAccountingRequest(request(MCP_KEY))).toEqual({ ok: false, status: 401, reason: "UNAUTHORIZED" });
  });

  it("rejects another company", () => {
    expect(authenticateAccountingRequest(request(ACCOUNTING_KEY, "other"))).toEqual({ ok: false, status: 403, reason: "FORBIDDEN" });
  });

  it("fails closed when the key is missing or short", () => {
    process.env.ACCOUNTING_API_KEY = "short";
    expect(authenticateAccountingRequest(request("short"))).toEqual({ ok: false, status: 503, reason: "SERVICE_NOT_CONFIGURED" });
    delete process.env.ACCOUNTING_API_KEY;
    expect(authenticateAccountingRequest(request(""))).toEqual({ ok: false, status: 503, reason: "SERVICE_NOT_CONFIGURED" });
  });
});
