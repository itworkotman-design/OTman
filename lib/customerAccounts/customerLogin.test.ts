import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accountFindUnique: vi.fn(),
  accountUpdate: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  checkRateLimit: vi.fn(),
  incrementRateLimit: vi.fn(),
  clearRateLimit: vi.fn(),
  createCustomerSession: vi.fn(),
  revokeCustomerSessions: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { customerAccount: { findUnique: mocks.accountFindUnique, update: mocks.accountUpdate } },
}));
vi.mock("@/lib/auth/password", () => ({ verifyPassword: mocks.verifyPassword, hashPassword: mocks.hashPassword }));
vi.mock("@/lib/auth/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  incrementRateLimit: mocks.incrementRateLimit,
  clearRateLimit: mocks.clearRateLimit,
}));
vi.mock("./customerSession", () => ({
  createCustomerSession: mocks.createCustomerSession,
  revokeCustomerSessions: mocks.revokeCustomerSessions,
}));
vi.mock("./generatedPassword", () => ({ generateCustomerPassword: () => "Newpass23456" }));

import { loginCustomer, resetCustomerPassword } from "./customerLogin";

const NOW = new Date("2026-10-05T12:00:00Z");
const openOrder = { id: "o1", status: "processing", statusChangedAt: NOW, updatedAt: NOW, gdprHold: false, createdAt: NOW };

describe("loginCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.createCustomerSession.mockResolvedValue({ token: "tok", expiresAt: NOW });
  });

  it("logs in with the right email (any case) and password", async () => {
    mocks.accountFindUnique.mockResolvedValue({ id: "acc-1", passwordHash: "h", orders: [openOrder] });
    mocks.verifyPassword.mockResolvedValue(true);

    const result = await loginCustomer({ email: " Kari@Example.com", password: "pw", ip: "1.2.3.4", now: NOW });

    expect(result).toEqual({ ok: true, accountId: "acc-1", token: "tok", expiresAt: NOW });
    expect(mocks.accountFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "kari@example.com" } }));
    expect(mocks.verifyPassword).toHaveBeenCalledWith("h", "pw");
    expect(mocks.accountUpdate).toHaveBeenCalledWith({ where: { id: "acc-1" }, data: { lastLoginAt: NOW } });
    expect(mocks.clearRateLimit).toHaveBeenCalledWith("customer-login:email:kari@example.com");
  });

  it("refuses a wrong password and counts the attempt", async () => {
    mocks.accountFindUnique.mockResolvedValue({ id: "acc-1", passwordHash: "h", orders: [openOrder] });
    mocks.verifyPassword.mockResolvedValue(false);

    expect(await loginCustomer({ email: "kari@example.com", password: "bad", ip: "1.2.3.4", now: NOW })).toEqual({
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });
    expect(mocks.incrementRateLimit).toHaveBeenCalledWith(expect.objectContaining({ key: "customer-login:email:kari@example.com" }));
    expect(mocks.incrementRateLimit).toHaveBeenCalledWith(expect.objectContaining({ key: "customer-login:ip:1.2.3.4" }));
    expect(mocks.createCustomerSession).not.toHaveBeenCalled();
  });

  it("gives the same answer for an unknown email", async () => {
    mocks.accountFindUnique.mockResolvedValue(null);
    expect(await loginCustomer({ email: "nobody@example.com", password: "pw", now: NOW })).toEqual({
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });
  });

  it("refuses an account that is past its delete time even before the cron removed it", async () => {
    const old = new Date("2026-09-01T00:00:00Z");
    mocks.accountFindUnique.mockResolvedValue({
      id: "acc-1",
      passwordHash: "h",
      orders: [{ ...openOrder, status: "completed", statusChangedAt: old, updatedAt: old }],
    });
    mocks.verifyPassword.mockResolvedValue(true);

    expect(await loginCustomer({ email: "kari@example.com", password: "pw", now: NOW })).toEqual({
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });
  });

  it("is rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 });
    expect(await loginCustomer({ email: "kari@example.com", password: "pw", now: NOW })).toEqual({
      ok: false,
      reason: "RATE_LIMITED",
    });
    expect(mocks.accountFindUnique).not.toHaveBeenCalled();
  });

  it("refuses an empty email or password", async () => {
    expect(await loginCustomer({ email: "", password: "pw" })).toEqual({ ok: false, reason: "INVALID_CREDENTIALS" });
    expect(await loginCustomer({ email: "a@b.no", password: "" })).toEqual({ ok: false, reason: "INVALID_CREDENTIALS" });
  });
});

describe("resetCustomerPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.hashPassword.mockResolvedValue("new-hash");
  });

  it("gives a live account a new password, signs out its sessions and says which order to log it on", async () => {
    const older = { ...openOrder, id: "o0", createdAt: new Date("2026-09-30T00:00:00Z") };
    mocks.accountFindUnique.mockResolvedValue({ id: "acc-1", email: "kari@example.com", passwordHash: "h", orders: [older, openOrder] });

    const result = await resetCustomerPassword({ email: "Kari@example.com", ip: "1.2.3.4", now: NOW });

    expect(result).toEqual({ accountId: "acc-1", email: "kari@example.com", newPassword: "Newpass23456", orderId: "o1" });
    expect(mocks.accountUpdate).toHaveBeenCalledWith({ where: { id: "acc-1" }, data: { passwordHash: "new-hash" } });
    expect(mocks.revokeCustomerSessions).toHaveBeenCalledWith("acc-1");
  });

  it("does nothing for an unknown or expired account", async () => {
    mocks.accountFindUnique.mockResolvedValue(null);
    expect(await resetCustomerPassword({ email: "nobody@example.com", now: NOW })).toBeNull();

    const old = new Date("2026-09-01T00:00:00Z");
    mocks.accountFindUnique.mockResolvedValue({
      id: "acc-1",
      email: "kari@example.com",
      passwordHash: "h",
      orders: [{ ...openOrder, status: "cancelled", statusChangedAt: old, updatedAt: old }],
    });
    expect(await resetCustomerPassword({ email: "kari@example.com", now: NOW })).toBeNull();
    expect(mocks.accountUpdate).not.toHaveBeenCalled();
  });

  it("does nothing when rate limited, but still counts the request", async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterMs: 1000 });
    expect(await resetCustomerPassword({ email: "kari@example.com", now: NOW })).toBeNull();
    expect(mocks.accountFindUnique).not.toHaveBeenCalled();
  });
});
