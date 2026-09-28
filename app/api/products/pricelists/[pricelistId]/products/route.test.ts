import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultPriceListSettings,
  serializePriceListSettings,
} from "@/lib/products/priceListSettings";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  requireFullAccessMembershipMock: vi.fn(),
  priceListFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  productCreateMock: vi.fn(),
  productOptionCreateMock: vi.fn(),
  priceListItemCreateMock: vi.fn(),
  priceListProductCreateMock: vi.fn(),
  executeRawMock: vi.fn(),
  getProductConfigMapMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/products/pricelistAccess", () => ({
  requireFullAccessMembership: mocks.requireFullAccessMembershipMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    priceList: { findUnique: mocks.priceListFindUniqueMock },
    $transaction: mocks.transactionMock,
  },
}));

vi.mock("@/lib/products/productConfig", () => ({
  getProductConfigMap: mocks.getProductConfigMapMock,
}));

import { POST } from "./route";

function call(body: unknown = {}) {
  return POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ pricelistId: "pl-1" }),
  });
}

function deliveryOnlyDescription() {
  const settings = createDefaultPriceListSettings();
  settings.deliveryOnly = true;
  return serializePriceListSettings(settings);
}

describe("POST /api/products/pricelists/[pricelistId]/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true, membership: { role: "OWNER" } });
    mocks.productCreateMock.mockResolvedValue({ id: "p-new", name: "New Product", code: "PROD_1" });
    mocks.productOptionCreateMock.mockResolvedValue({
      id: "o-new",
      code: "OPT_1",
      label: "Option: ",
      description: null,
      category: "install",
      sortOrder: 1,
    });
    mocks.priceListItemCreateMock.mockImplementation(async () => ({
      id: "i-new",
      productOptionId: "o-new",
      customerPriceCents: 0,
      subcontractorPriceCents: 0,
      isActive: true,
      productOption: {
        id: "o-new",
        code: "OPT_1",
        label: "Option: ",
        description: null,
        category: "install",
        sortOrder: 1,
        product: { id: "p-new", name: "New Product", code: "PROD_1" },
      },
    }));
    mocks.priceListProductCreateMock.mockResolvedValue({});
    mocks.executeRawMock.mockResolvedValue(1);
    mocks.getProductConfigMapMock.mockResolvedValue(
      new Map([["p-new", { id: "p-new", productType: "PHYSICAL", deliveryTypes: [] }]]),
    );
    mocks.transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        product: { create: mocks.productCreateMock },
        productOption: { create: mocks.productOptionCreateMock },
        priceListItem: { create: mocks.priceListItemCreateMock },
        priceListProduct: { create: mocks.priceListProductCreateMock },
        $executeRaw: mocks.executeRawMock,
      }),
    );
  });

  it("returns the gate's response when the caller isn't a full-access member", async () => {
    mocks.requireFullAccessMembershipMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }),
    });

    expect((await call()).status).toBe(403);
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("adds a product with a first install option to a normal price list", async () => {
    mocks.priceListFindUniqueMock.mockResolvedValue({ description: null });

    const res = await call();
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(mocks.productOptionCreateMock).toHaveBeenCalledTimes(1);
    expect(mocks.priceListItemCreateMock).toHaveBeenCalledTimes(1);
    expect(mocks.priceListProductCreateMock).not.toHaveBeenCalled();
    expect(json.item.id).toBe("i-new");
  });

  it("adds a delivery-only product — linked to the list, with no option or price-list item — to a delivery-only price list", async () => {
    mocks.priceListFindUniqueMock.mockResolvedValue({ description: deliveryOnlyDescription() });

    const res = await call({ name: "Envelope" });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(mocks.productCreateMock.mock.calls[0][0].data.name).toBe("Envelope");
    expect(mocks.productOptionCreateMock).not.toHaveBeenCalled();
    expect(mocks.priceListItemCreateMock).not.toHaveBeenCalled();
    expect(mocks.priceListProductCreateMock).toHaveBeenCalledWith({
      data: { priceListId: "pl-1", productId: "p-new" },
    });
    expect(json.deliveryOnlyProduct).toEqual(
      expect.objectContaining({ productId: "p-new", productName: "New Product", productCode: "PROD_1" }),
    );
    expect(json.item).toBeUndefined();
  });

  it("404s for an unknown price list", async () => {
    mocks.priceListFindUniqueMock.mockResolvedValue(null);

    expect((await call()).status).toBe(404);
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });
});
