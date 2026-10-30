import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  requireFullAccessMembershipMock: vi.fn(),
  itemFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  executeRawMock: vi.fn(),
  getProductConfigMapMock: vi.fn(),
  savePriceListProductConfigMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/products/pricelistAccess", () => ({
  requireFullAccessMembership: mocks.requireFullAccessMembershipMock,
}));

vi.mock("@/lib/products/productConfig", () => ({
  getProductConfigMap: mocks.getProductConfigMapMock,
  savePriceListProductConfig: mocks.savePriceListProductConfigMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    priceListItem: { findUnique: mocks.itemFindUniqueMock },
    $transaction: mocks.transactionMock,
  },
}));

import { PATCH } from "./route";

const tx = {
  $executeRaw: mocks.executeRawMock,
  priceListItem: { findUnique: mocks.itemFindUniqueMock, update: vi.fn() },
  productOption: { update: vi.fn() },
};

const ITEM = {
  id: "item-1",
  priceListId: "list-business",
  productOptionId: "opt-1",
  customerPriceCents: 60900,
  subcontractorPriceCents: 40200,
  discountAmountCents: null,
  discountEndsAt: null,
  isActive: true,
  productOption: {
    id: "opt-1",
    productId: "p-fridge",
    code: "INSFRIDGE",
    label: "Option",
    description: null,
    category: "install",
    sortOrder: 1,
    product: {
      id: "p-fridge",
      name: "Kjøleskap",
      code: "FRIDGE",
      productType: "PHYSICAL",
      allowDeliveryTypes: true,
      allowInstallOptions: true,
      allowReturnOptions: true,
      allowExtraServices: true,
      allowDemont: true,
      allowQuantity: true,
      allowPeopleCount: false,
      allowHoursInput: false,
      allowModelNumber: true,
      autoXtraPerPallet: false,
      autoDeliveryPrice: null,
    },
  },
};

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request("http://localhost/api/products/pricelists/items/item-1/full", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ itemId: "item-1" }) },
  );
}

describe("PATCH /api/products/pricelists/items/[itemId]/full", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "u1", activeCompanyId: "c1" });
    mocks.requireFullAccessMembershipMock.mockResolvedValue({ ok: true });
    mocks.itemFindUniqueMock.mockResolvedValue(ITEM);
    mocks.transactionMock.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    mocks.getProductConfigMapMock.mockResolvedValue(new Map());
  });

  it("saves delivery pricing on the item's own price list, not on the shared product", async () => {
    const deliveryTypes = [{ key: "INDOOR", code: "INDOOR", label: "Innbæring", price: "552", subcontractorPrice: "371", xtraPrice: "183", enabled: true }];

    const response = await patch({ deliveryTypes });

    expect(response.status).toBe(200);
    expect(mocks.savePriceListProductConfigMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        priceListId: "list-business",
        productId: "p-fridge",
        deliveryTypes: expect.arrayContaining([expect.objectContaining({ key: "INDOOR", price: "552" })]),
      }),
    );
    expect(mocks.executeRawMock).not.toHaveBeenCalled();
  });

  it("saves auto delivery price and custom sections on the price list too", async () => {
    await patch({
      autoDeliveryPrice: { code: "ATTENDENCE", label: "Oppmøte", price: "520", subcontractorPrice: "442", enabled: true },
      customSections: [{ id: "s1", title: "Dør", options: [{ id: "o1", code: "DORTILGLIDE", label: "Dør", price: "800", subcontractorPrice: "680" }] }],
    });

    expect(mocks.savePriceListProductConfigMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        priceListId: "list-business",
        productId: "p-fridge",
        autoDeliveryPrice: expect.objectContaining({ price: "520" }),
        customSections: [expect.objectContaining({ options: [expect.objectContaining({ price: "800" })] })],
      }),
    );
    expect(mocks.executeRawMock).not.toHaveBeenCalled();
  });

  it("still saves product-wide settings like the name on the product", async () => {
    await patch({ productName: "Kjøleskap XL" });

    expect(mocks.executeRawMock).toHaveBeenCalledTimes(1);
    expect(mocks.savePriceListProductConfigMock).not.toHaveBeenCalled();
  });

  it("returns the delivery pricing as seen by the item's price list", async () => {
    await patch({ productName: "Kjøleskap XL" });

    expect(mocks.getProductConfigMapMock).toHaveBeenCalledWith(["p-fridge"], "list-business");
  });
});
