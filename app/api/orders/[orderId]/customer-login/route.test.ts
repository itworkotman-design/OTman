import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSession: vi.fn(),
  membershipFindFirst: vi.fn(),
  orderFindFirst: vi.fn(),
  getModuleAccess: vi.fn(),
  ensureCustomerAccountForOrder: vi.fn(),
  sendCustomerCredentialsEmail: vi.fn(),
  createOrderActionEvent: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthenticatedSession: mocks.getAuthenticatedSession }));
vi.mock("@/lib/users/access", () => ({ getModuleAccess: mocks.getModuleAccess }));
vi.mock("@/lib/db", () => ({
  prisma: { membership: { findFirst: mocks.membershipFindFirst }, order: { findFirst: mocks.orderFindFirst } },
}));
vi.mock("@/lib/customerAccounts/ensureCustomerAccount", () => ({ ensureCustomerAccountForOrder: mocks.ensureCustomerAccountForOrder }));
vi.mock("@/lib/customerAccounts/customerCredentialsEmail", () => ({ sendCustomerCredentialsEmail: mocks.sendCustomerCredentialsEmail }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderActionEvent: mocks.createOrderActionEvent }));

import { POST } from "./route";

const params = { params: Promise.resolve({ orderId: "order-1" }) };
const post = () => POST(new Request("http://localhost", { method: "POST" }), params);

const order = { id: "order-1", companyId: "c1", displayId: 42, orderNumber: "583920", customerName: "Kari", email: "kari@example.no", isWebsiteOrder: true };

describe("POST /api/orders/[orderId]/customer-login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSession.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirst.mockResolvedValue({ id: "m1", role: "ADMIN", appAccess: [], user: { username: "Staff", email: "s@otman.no" } });
    mocks.getModuleAccess.mockReturnValue({ enabled: false, level: "VIEWER" });
    mocks.orderFindFirst.mockResolvedValue(order);
    mocks.ensureCustomerAccountForOrder.mockResolvedValue({ accountId: "a1", email: "kari@example.no", newPassword: "Abcdefgh2345" });
    mocks.sendCustomerCredentialsEmail.mockResolvedValue(true);
  });

  it("needs a logged-in staff member who can edit website orders", async () => {
    mocks.getAuthenticatedSession.mockResolvedValue(null);
    expect((await post()).status).toBe(401);

    mocks.getAuthenticatedSession.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.membershipFindFirst.mockResolvedValue({ id: "m1", role: "USER", appAccess: [], user: null });
    expect((await post()).status).toBe(403);
    expect(mocks.ensureCustomerAccountForOrder).not.toHaveBeenCalled();
  });

  it("lets a USER with Website orders at ADMIN level do it", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ id: "m1", role: "USER", appAccess: [], user: null });
    mocks.getModuleAccess.mockReturnValue({ enabled: true, level: "ADMIN" });
    expect((await post()).status).toBe(200);
  });

  it("only finds website orders in the staff member's company", async () => {
    mocks.orderFindFirst.mockResolvedValue(null);
    expect((await post()).status).toBe(404);
    expect(mocks.orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order-1", companyId: "c1", isWebsiteOrder: true } }),
    );
  });

  it("refuses an order without an email", async () => {
    mocks.orderFindFirst.mockResolvedValue({ ...order, email: null });
    mocks.ensureCustomerAccountForOrder.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe("MISSING_CUSTOMER_EMAIL");
  });

  it("always sets a new password and emails it", async () => {
    const res = await post();

    expect(await res.json()).toEqual({ ok: true, email: "kari@example.no" });
    expect(mocks.ensureCustomerAccountForOrder).toHaveBeenCalledWith({ orderId: "order-1", email: "kari@example.no", forceNewPassword: true });
    expect(mocks.sendCustomerCredentialsEmail).toHaveBeenCalledWith({
      order: { id: "order-1", companyId: "c1", displayId: 42, orderNumber: "583920", customerName: "Kari" },
      email: "kari@example.no",
      password: "Abcdefgh2345",
    });
  });

  it("reports a failed email", async () => {
    mocks.sendCustomerCredentialsEmail.mockResolvedValue(false);
    const res = await post();
    expect(res.status).toBe(502);
    expect((await res.json()).reason).toBe("EMAIL_FAILED");
  });
});
