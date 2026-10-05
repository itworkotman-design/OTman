import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membershipFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
  },
}));

import { getInsuranceCasesStore, getInsuranceCasesUserEmail } from "./insuranceCases";

describe("getInsuranceCasesUserEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when the env var is unset or blank", () => {
    vi.stubEnv("INSURANCE_CASES_USER_EMAIL", "");
    expect(getInsuranceCasesUserEmail()).toBeNull();

    vi.stubEnv("INSURANCE_CASES_USER_EMAIL", "   ");
    expect(getInsuranceCasesUserEmail()).toBeNull();
  });

  it("trims and lowercases the configured email", () => {
    vi.stubEnv("INSURANCE_CASES_USER_EMAIL", "  Insurance@Example.COM ");
    expect(getInsuranceCasesUserEmail()).toBe("insurance@example.com");
  });
});

describe("getInsuranceCasesStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns NOT_CONFIGURED without querying when the env var is unset", async () => {
    vi.stubEnv("INSURANCE_CASES_USER_EMAIL", "");

    await expect(getInsuranceCasesStore("company-1")).resolves.toEqual({
      ok: false,
      reason: "NOT_CONFIGURED",
    });
    expect(mocks.membershipFindFirstMock).not.toHaveBeenCalled();
  });

  it("looks up the active membership for that email in the given company", async () => {
    vi.stubEnv("INSURANCE_CASES_USER_EMAIL", "Insurance@Example.com");
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-9",
      user: { email: "insurance@example.com", username: "Forsikring AS" },
    });

    await expect(getInsuranceCasesStore("company-1")).resolves.toEqual({
      ok: true,
      membershipId: "membership-9",
      label: "Forsikring AS",
    });

    expect(mocks.membershipFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "company-1",
          status: "ACTIVE",
          user: { email: { equals: "insurance@example.com", mode: "insensitive" } },
        },
      }),
    );
  });

  it("falls back to the email as label when the user has no username", async () => {
    vi.stubEnv("INSURANCE_CASES_USER_EMAIL", "insurance@example.com");
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-9",
      user: { email: "insurance@example.com", username: null },
    });

    await expect(getInsuranceCasesStore("company-1")).resolves.toEqual({
      ok: true,
      membershipId: "membership-9",
      label: "insurance@example.com",
    });
  });

  it("returns USER_NOT_FOUND when no active membership matches", async () => {
    vi.stubEnv("INSURANCE_CASES_USER_EMAIL", "insurance@example.com");
    mocks.membershipFindFirstMock.mockResolvedValue(null);

    await expect(getInsuranceCasesStore("company-1")).resolves.toEqual({
      ok: false,
      reason: "USER_NOT_FOUND",
      email: "insurance@example.com",
    });
  });
});
