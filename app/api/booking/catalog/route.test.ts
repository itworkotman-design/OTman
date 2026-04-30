import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultProductAutoDeliveryPrice } from "@/lib/products/autoDeliveryPrice";
import { createDefaultProductDeliveryTypes } from "@/lib/products/deliveryTypes";
import { createDefaultPriceListSettings } from "@/lib/products/priceListSettings";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  getActiveMembershipMock: vi.fn(),
  findUniqueMock: vi.fn(),
  productFindManyMock: vi.fn(),
  queryRawMock: vi.fn(),
  getEffectivePriceMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/auth/membership", () => ({
  getActiveMembership: mocks.getActiveMembershipMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mocks.queryRawMock,
    priceList: {
      findUnique: mocks.findUniqueMock,
    },
    product: {
      findMany: mocks.productFindManyMock,
    },
  },
}));

vi.mock("@/lib/products/discounts", () => ({
  getEffectivePrice: mocks.getEffectivePriceMock,
}));

import { GET } from "./route";

describe("GET /api/booking/catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEffectivePriceMock.mockImplementation(
      ({ basePrice, discountAmount = null }) =>
        typeof discountAmount === "number" ? basePrice - discountAmount : basePrice,
    );
    mocks.productFindManyMock.mockResolvedValue([]);
  });

  it("returns 401 when there is no authenticated session", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/booking/catalog"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("returns 409 when neither the request nor membership provides a price list", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.getActiveMembershipMock.mockResolvedValue({
      id: "membership-1",
      priceListId: null,
    });

    const res = await GET(new Request("http://localhost/api/booking/catalog"));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "PRICE_LIST_NOT_ASSIGNED",
    });
    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns a normalized catalog payload when a price list exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.getActiveMembershipMock.mockResolvedValue({
      id: "membership-1",
      priceListId: "membership-price-list",
    });
    mocks.queryRawMock.mockResolvedValue([
      {
        id: "product-1",
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
        customSections: [],
      },
    ]);
    mocks.findUniqueMock.mockResolvedValue({
      id: "price-list-1",
      code: "PL-1",
      items: [
        {
          productOptionId: "option-1",
          isActive: true,
          customerPriceCents: 12000,
          subcontractorPriceCents: 9000,
          discountAmountCents: 2000,
          discountEndsAt: new Date("2030-01-10T00:00:00.000Z"),
          productOption: {
            id: "option-1",
            code: "OPT-1",
            label: "Small",
            description: "Small van",
            category: "vans",
            product: {
              id: "product-1",
              code: "PROD-1",
              name: "Moving van",
              isActive: true,
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
            },
          },
        },
      ],
      specialOptions: [
        {
          id: "special-1",
          type: "SERVICE",
          code: "STAIRS",
          label: "Stairs",
          description: "Carry upstairs",
          customerPrice: "750",
          subcontractorPrice: "500",
          discountAmount: "100",
          discountEndsAt: new Date("2030-01-12T00:00:00.000Z"),
          isActive: true,
        },
      ],
    });
    mocks.productFindManyMock.mockResolvedValue([
      {
        id: "product-1",
        code: "PROD-1",
        name: "Moving van",
        isActive: true,
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
        options: [
          {
            id: "option-1",
            code: "OPT-1",
            label: "Small",
            description: "Small van",
            category: "vans",
            isActive: true,
          },
        ],
      },
      {
        id: "product-pallet",
        code: "PALLET",
        name: "Pall",
        isActive: true,
        productType: "PALLET",
        allowDeliveryTypes: false,
        allowInstallOptions: false,
        allowReturnOptions: false,
        allowExtraServices: false,
        allowDemont: false,
        allowQuantity: true,
        allowPeopleCount: false,
        allowHoursInput: false,
        allowModelNumber: false,
        autoXtraPerPallet: true,
        options: [],
      },
    ]);

    const res = await GET(
      new Request("http://localhost/api/booking/catalog?priceListId=requested-list"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      priceListId: "price-list-1",
      priceListCode: "PL-1",
      priceListSettings: createDefaultPriceListSettings(),
      products: [
        {
          id: "product-1",
          code: "PROD-1",
          label: "Moving van",
          active: true,
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
          autoDeliveryPrice: createDefaultProductAutoDeliveryPrice(),
          deliveryTypes: createDefaultProductDeliveryTypes(),
          customSections: [],
          options: [
            {
              id: "option-1",
              code: "OPT-1",
              label: "Small",
              description: "Small van",
              category: "vans",
              customerPrice: "120",
              subcontractorPrice: "90",
              effectiveCustomerPrice: "100",
              active: true,
            },
          ],
        },
        {
          id: "product-pallet",
          code: "PALLET",
          label: "Pall",
          active: true,
          productType: "PALLET",
          allowDeliveryTypes: false,
          allowInstallOptions: false,
          allowReturnOptions: false,
          allowExtraServices: false,
          allowDemont: false,
          allowQuantity: true,
          allowPeopleCount: false,
          allowHoursInput: false,
          allowModelNumber: false,
          autoXtraPerPallet: true,
          autoDeliveryPrice: createDefaultProductAutoDeliveryPrice(),
          deliveryTypes: [],
          customSections: [],
          options: [],
        },
      ],
      specialOptions: [
        {
          id: "special-1",
          type: "service",
          code: "STAIRS",
          label: "Stairs",
          description: "Carry upstairs",
          customerPrice: "750",
          subcontractorPrice: "500",
          discountAmount: "100",
          discountEndsAt: "2030-01-12",
          effectiveCustomerPrice: "650",
          active: true,
        },
      ],
    });

    expect(mocks.findUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "requested-list" },
      }),
    );
  });
});
