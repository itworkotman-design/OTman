import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ orderFindManyMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { order: { findMany: mocks.orderFindManyMock } } }));

import { GET } from "./route";

const API_KEY = "test-api-key-with-at-least-32-characters";
const COMPANY_ID = "company-fixed";
const originalApiKey = process.env.OTMAN_API_KEY;
const originalCompanyId = process.env.OTMAN_API_COMPANY_ID;

function createRequest(query: string) {
  return GET(
    new Request(`http://localhost/api/integrations/mcp/orders/list${query}`, {
      headers: { Authorization: `Bearer ${API_KEY}`, "X-Otman-Company-Id": COMPANY_ID },
    }),
  );
}

describe("GET /api/integrations/mcp/orders/list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OTMAN_API_KEY = API_KEY;
    process.env.OTMAN_API_COMPANY_ID = COMPANY_ID;
    mocks.orderFindManyMock.mockResolvedValue([]);
  });

  afterAll(() => {
    if (originalApiKey === undefined) delete process.env.OTMAN_API_KEY;
    else process.env.OTMAN_API_KEY = originalApiKey;
    if (originalCompanyId === undefined) delete process.env.OTMAN_API_COMPANY_ID;
    else process.env.OTMAN_API_COMPANY_ID = originalCompanyId;
  });

  it("rejects a malformed fromDate", async () => {
    const response = await createRequest("?fromDate=09-25-2026");
    expect(response.status).toBe(400);
    expect(mocks.orderFindManyMock).not.toHaveBeenCalled();
  });

  it("scopes the query to the fixed company and applies date/customer/status filters", async () => {
    const response = await createRequest(
      "?fromDate=2026-09-01&toDate=2026-09-30&customer=POWER&status=confirmed",
    );

    expect(response.status).toBe(200);
    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: COMPANY_ID,
          deliveryDate: { gte: "2026-09-01", lte: "2026-09-30" },
          customerLabel: { contains: "POWER", mode: "insensitive" },
          OR: expect.arrayContaining([
            { status: { equals: "confirmed", mode: "insensitive" } },
            { status: { equals: "bekreftet", mode: "insensitive" } },
          ]),
        }),
      }),
    );
  });

  it("derives financial fields from the pricingSnapshot JSON", async () => {
    mocks.orderFindManyMock.mockResolvedValue([
      {
        displayId: 22551,
        orderNumber: "11160722247",
        customerName: "Example Customer",
        customerLabel: "POWER Skullerud",
        deliveryDate: "2026-09-25",
        servicesSummary: "Carry-in delivery",
        status: "bekreftet",
        driver: "Driver A",
        pricingSnapshot: {
          customer: { discount: 0, extra: 0, vat: 327, totalIncVat: 1635 },
          subcontractor: { total: 773 },
          lines: [
            {
              itemType: "EXTRA_OPTION",
              optionLabel: "Innbæring",
              productName: "Fridge",
              deliveryType: "Innbæring",
              quantity: 1,
              customerLineTotal: 690,
              subcontractorLineTotal: 464,
            },
          ],
        },
      },
    ]);

    const response = await createRequest("");
    const body = await response.json();

    expect(body.orders[0]).toMatchObject({
      orderNumber: 22551,
      externalReference: "11160722247",
      store: "POWER Skullerud",
      status: "confirmed",
      vat: 327,
      totalPrice: 1635,
      directCost: 773,
    });
    expect(body.orders[0].lines).toHaveLength(1);
    expect(body.orders[0].lines[0]).toMatchObject({
      itemType: "EXTRA_OPTION",
      label: "Innbæring",
      customerLineTotal: 690,
      subcontractorLineTotal: 464,
    });
  });

  it("handles a null pricingSnapshot without throwing", async () => {
    mocks.orderFindManyMock.mockResolvedValue([
      {
        displayId: 1,
        orderNumber: null,
        customerName: null,
        customerLabel: null,
        deliveryDate: null,
        servicesSummary: null,
        status: null,
        driver: null,
        pricingSnapshot: null,
      },
    ]);

    const response = await createRequest("");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.orders[0]).toMatchObject({
      orderNumber: 1,
      totalPrice: null,
      directCost: null,
      lines: [],
    });
  });
});
