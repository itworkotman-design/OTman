import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  requireFullAccessMembershipMock: vi.fn(),
  linkFindUniqueMock: vi.fn(),
  executeRawMock: vi.fn(),
  getProductConfigMapMock: vi.fn(),
  savePriceListProductConfigMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/products/pricelistAccess", () => ({
  requireFullAccessMembership: mocks.requireFullAccessMembershipMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    priceListProduct: { findUnique: mocks.linkFindUniqueMock },
    $executeRaw: mocks.executeRawMock,
    $transaction: mocks.transactionMock,
  },
}));

vi.mock("@/lib/products/productConfig", () => ({
  getProductConfigMap: mocks.getProductConfigMapMock,
  savePriceListProductConfig: mocks.savePriceListProductConfigMock,
}));

import { PATCH } from "./route";

function call(body: unknown, pricelistId = "pl-1", productId = "p-pose") {
  return PATCH(
    new Request("http://localhost/api", { method: "PATCH", body: JSON.stringify(body) }),
    { params: Promise.resolve({ pricelistId, productId }) },
  );
}

const DELIVERY_TYPES = [
  { key: "FIRST_STEP", enabled: true, code: "FIRST_STEP", label: "Delivery", price: "99", xtraPrice: "0" },
];

describe("PATCH /api/products/pricelists/[pricelistId]/products/[productId]/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.linkFindUniqueMock.mockResolvedValue({ id: "link-1" });
    mocks.executeRawMock.mockResolvedValue(1);
    mocks.savePriceListProductConfigMock.mockResolvedValue(undefined);
    mocks.transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({ $executeRaw: mocks.executeRawMock, priceListProductConfig: {} }),
    );
    mocks.getProductConfigMapMock.mockResolvedValue(
      new Map([["p-pose", { id: "p-pose", productType: "PHYSICAL", deliveryTypes: DELIVERY_TYPES }]]),
    );
  });

  it("returns the gate's response when the caller isn't a full-access member", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }),
    });

    const res = await call({ deliveryTypes: DELIVERY_TYPES });

    expect(res.status).toBe(403);
    expect(mocks.executeRawMock).not.toHaveBeenCalled();
  });

  it("404s for a product that isn't a delivery-only product of this price list", async () => {
    mocks.linkFindUniqueMock.mockResolvedValue(null);

    const res = await call({ deliveryTypes: DELIVERY_TYPES }, "pl-1", "p-other");

    expect(res.status).toBe(404);
    expect(mocks.linkFindUniqueMock.mock.calls[0][0].where).toEqual({
      priceListId_productId: { priceListId: "pl-1", productId: "p-other" },
    });
    expect(mocks.executeRawMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid product type", async () => {
    const res = await call({ productType: "BANANA" });

    expect(res.status).toBe(400);
    expect(mocks.executeRawMock).not.toHaveBeenCalled();
  });

  it("renames the product, trimming the name", async () => {
    const res = await call({ name: "  Big envelope  " });

    expect(res.status).toBe(200);
    expect(mocks.executeRawMock).toHaveBeenCalledTimes(1);
    expect(mocks.executeRawMock.mock.calls[0].slice(1)).toContain("Big envelope");
  });

  it("rejects an empty name", async () => {
    const res = await call({ name: "   " });

    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe("INVALID_PRODUCT_NAME");
    expect(mocks.executeRawMock).not.toHaveBeenCalled();
  });

  it("saves delivery pricing on this price list only, never on the shared Product row", async () => {
    const res = await call({ deliveryTypes: DELIVERY_TYPES });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.savePriceListProductConfigMock).toHaveBeenCalledTimes(1);
    expect(mocks.savePriceListProductConfigMock.mock.calls[0][1]).toMatchObject({
      priceListId: "pl-1",
      productId: "p-pose",
      deliveryTypes: expect.arrayContaining([expect.objectContaining({ key: "FIRST_STEP", price: "99" })]),
    });
    const productSql = mocks.executeRawMock.mock.calls.map((c) => (c[0] as string[]).join("?")).join("\n");
    expect(productSql).not.toContain("deliveryTypes");
    expect(productSql).not.toContain("autoDeliveryPrice");
    expect(productSql).not.toContain("customSections");
    expect(mocks.getProductConfigMapMock).toHaveBeenCalledWith(["p-pose"], "pl-1");
    expect(json.ok).toBe(true);
    expect(json.product.id).toBe("p-pose");
    expect(json.product.deliveryTypes).toEqual(DELIVERY_TYPES);
  });
});
