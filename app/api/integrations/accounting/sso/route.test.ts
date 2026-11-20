import { generateKeyPairSync, verify } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSessionMock: vi.fn(), membershipFindUniqueMock: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getAuthenticatedSession: mocks.getSessionMock }));
vi.mock("@/lib/db", () => ({ prisma: { membership: { findUnique: mocks.membershipFindUniqueMock } } }));

import { GET } from "./route";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const COMPANY_ID = "company-fixed";
const saved = { ...process.env };

const session = (extra: Record<string, unknown> = {}) => ({
  sessionId: "s1",
  userId: "user-1",
  email: "ola@otman.no",
  username: "Ola",
  userStatus: "ACTIVE",
  activeCompanyId: COMPANY_ID,
  ...extra,
});
const membership = (enabled: boolean, status = "ACTIVE") => ({ status, appAccess: [{ module: "ACCOUNTING", enabled, level: "ADMIN" }] });

const get = () => GET(new Request("https://otman.no/api/integrations/accounting/sso"));

describe("GET /api/integrations/accounting/sso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ACCOUNTING_SSO_PRIVATE_KEY = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
    process.env.ACCOUNTING_APP_URL = "https://accounting.otman.no";
    process.env.OTMAN_API_COMPANY_ID = COMPANY_ID;
  });

  afterAll(() => {
    process.env = { ...saved };
  });

  it("sends someone not logged in to the login page", async () => {
    mocks.getSessionMock.mockResolvedValue(null);
    const response = await get();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://otman.no/login");
  });

  it("hands a person with Accounting access to the accounting app with a signed ticket", async () => {
    mocks.getSessionMock.mockResolvedValue(session());
    mocks.membershipFindUniqueMock.mockResolvedValue(membership(true));

    const response = await get();

    expect(response.status).toBe(303);
    expect(mocks.membershipFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_companyId: { userId: "user-1", companyId: COMPANY_ID } } }),
    );
    const location = new URL(response.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://accounting.otman.no/sso");
    const [, payload, signature] = location.searchParams.get("ticket")!.split(".");
    expect(verify(null, Buffer.from(`v1.${payload}`), publicKey, Buffer.from(signature, "base64url"))).toBe(true);
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toMatchObject({ sub: "user-1", email: "ola@otman.no", name: "Ola" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("uses the email as the name when there is no username", async () => {
    mocks.getSessionMock.mockResolvedValue(session({ username: null }));
    mocks.membershipFindUniqueMock.mockResolvedValue(membership(true));
    const location = new URL((await get()).headers.get("location")!);
    const payload = location.searchParams.get("ticket")!.split(".")[1];
    expect(JSON.parse(Buffer.from(payload, "base64url").toString()).name).toBe("ola@otman.no");
  });

  it.each([
    ["no Accounting access", session(), membership(false)],
    ["a disabled membership", session(), membership(true, "DISABLED")],
    ["no membership", session(), null],
    ["another company", session({ activeCompanyId: "other" }), membership(true)],
  ])("refuses %s", async (_label, s, m) => {
    mocks.getSessionMock.mockResolvedValue(s);
    mocks.membershipFindUniqueMock.mockResolvedValue(m);
    const response = await get();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, reason: "NO_ACCOUNTING_ACCESS" });
  });

  it("answers 503 when single sign-on isn't set up", async () => {
    delete process.env.ACCOUNTING_SSO_PRIVATE_KEY;
    mocks.getSessionMock.mockResolvedValue(session());
    mocks.membershipFindUniqueMock.mockResolvedValue(membership(true));
    const response = await get();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, reason: "SSO_NOT_CONFIGURED" });
  });
});
