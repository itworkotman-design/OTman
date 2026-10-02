import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelledOrderPartnerData,
  findCancelledOrderPartner,
} from "./cancelledOrderPartner";

const membershipFindFirstMock = vi.fn();
const prisma = { membership: { findFirst: membershipFindFirstMock } } as never;

describe("findCancelledOrderPartner", () => {
  const original = process.env.CANCELLED_ORDER_PARTNER_EMAIL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CANCELLED_ORDER_PARTNER_EMAIL = "Cancelled@Example.com";
  });

  afterEach(() => {
    process.env.CANCELLED_ORDER_PARTNER_EMAIL = original;
  });

  it("returns null without querying when the env var is not set", async () => {
    delete process.env.CANCELLED_ORDER_PARTNER_EMAIL;

    await expect(findCancelledOrderPartner(prisma, "company-1")).resolves.toBeNull();
    expect(membershipFindFirstMock).not.toHaveBeenCalled();
  });

  it("looks up an active membership in the order's company by email, case-insensitively", async () => {
    membershipFindFirstMock.mockResolvedValue({
      id: "membership-x",
      user: { username: " Kansellert ", email: "cancelled@example.com" },
    });

    await expect(findCancelledOrderPartner(prisma, "company-1")).resolves.toEqual({
      subcontractorMembershipId: "membership-x",
      subcontractor: "Kansellert",
    });
    expect(membershipFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "company-1",
          status: "ACTIVE",
          user: { email: { equals: "cancelled@example.com", mode: "insensitive" } },
        },
      }),
    );
  });

  it("falls back to the email when the user has no username", async () => {
    membershipFindFirstMock.mockResolvedValue({
      id: "membership-x",
      user: { username: null, email: "cancelled@example.com" },
    });

    await expect(findCancelledOrderPartner(prisma, "company-1")).resolves.toMatchObject({
      subcontractor: "cancelled@example.com",
    });
  });

  it("returns null when the user is not a member of the company (e.g. dev DB)", async () => {
    membershipFindFirstMock.mockResolvedValue(null);

    await expect(findCancelledOrderPartner(prisma, "company-1")).resolves.toBeNull();
  });
});

describe("cancelledOrderPartnerData", () => {
  const original = process.env.CANCELLED_ORDER_PARTNER_EMAIL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CANCELLED_ORDER_PARTNER_EMAIL = "cancelled@example.com";
    membershipFindFirstMock.mockResolvedValue({
      id: "membership-x",
      user: { username: "Kansellert", email: "cancelled@example.com" },
    });
  });

  afterEach(() => {
    process.env.CANCELLED_ORDER_PARTNER_EMAIL = original;
  });

  const noPartner = { subcontractorMembershipId: null, subcontractor: null };

  it("sets the partner when an order without one moves to cancelled", async () => {
    await expect(
      cancelledOrderPartnerData(prisma, {
        companyId: "company-1",
        previousStatus: "approved",
        nextStatus: "cancelled",
        partner: noPartner,
      }),
    ).resolves.toEqual({ subcontractorMembershipId: "membership-x", subcontractor: "Kansellert" });
  });

  it("keeps an existing partner", async () => {
    await expect(
      cancelledOrderPartnerData(prisma, {
        companyId: "company-1",
        previousStatus: "approved",
        nextStatus: "cancelled",
        partner: { subcontractorMembershipId: "membership-real", subcontractor: "Real" },
      }),
    ).resolves.toEqual({});
    expect(membershipFindFirstMock).not.toHaveBeenCalled();
  });

  it("does nothing when the order was already cancelled (incl. legacy alias)", async () => {
    await expect(
      cancelledOrderPartnerData(prisma, {
        companyId: "company-1",
        previousStatus: "kanselert",
        nextStatus: "cancelled",
        partner: noPartner,
      }),
    ).resolves.toEqual({});
  });

  it("does nothing for legacy orders (display id below 20000)", async () => {
    await expect(
      cancelledOrderPartnerData(prisma, {
        companyId: "company-1",
        displayId: 1234,
        previousStatus: "approved",
        nextStatus: "cancelled",
        partner: noPartner,
      }),
    ).resolves.toEqual({});
    expect(membershipFindFirstMock).not.toHaveBeenCalled();
  });

  it("does nothing for other statuses", async () => {
    await expect(
      cancelledOrderPartnerData(prisma, {
        companyId: "company-1",
        previousStatus: "approved",
        nextStatus: "completed",
        partner: noPartner,
      }),
    ).resolves.toEqual({});
  });

  it("does nothing when the configured user can't be found", async () => {
    membershipFindFirstMock.mockResolvedValue(null);

    await expect(
      cancelledOrderPartnerData(prisma, {
        companyId: "company-1",
        previousStatus: "approved",
        nextStatus: "cancelled",
        partner: noPartner,
      }),
    ).resolves.toEqual({});
  });
});
