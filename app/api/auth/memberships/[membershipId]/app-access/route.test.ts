import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    getAuthenticatedSessionMock: vi.fn(),
    getActiveMembershipMock: vi.fn(),
    findUniqueMock: vi.fn(),
    countMock: vi.fn(),
    transactionMock: vi.fn(),
    upsertMock: vi.fn(),
    dashboardSectionUpsertMock: vi.fn(),
    permissionDeleteManyMock: vi.fn(),
    permissionCreateManyMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/auth/membership", () => ({
  getActiveMembership: mocks.getActiveMembershipMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findUnique: mocks.findUniqueMock,
    },
    membershipAppAccess: {
      count: mocks.countMock,
    },
    $transaction: mocks.transactionMock,
  },
}));

import { PATCH } from "./route";

const FULL_ACCESS = [
  { module: "ARCHIVE", enabled: true, level: "ADMIN" },
  { module: "BOOKING", enabled: true, level: "ADMIN" },
  { module: "WEBSITE_EDITOR", enabled: false, level: "VIEWER" },
  { module: "WEBSITE_ORDERS", enabled: false, level: "VIEWER" },
  { module: "SCHEDULER", enabled: false, level: "VIEWER" },
  { module: "USER_MANAGEMENT", enabled: true, level: "ADMIN" },
  { module: "DASHBOARD", enabled: true, level: "ADMIN" },
];

const FULL_DASHBOARD_SECTIONS = [
  { section: "BOOKING_OVERVIEW", enabled: true },
  { section: "PEOPLE_ONLINE", enabled: false },
  { section: "REVIEWS", enabled: true },
  { section: "GDPR", enabled: false },
  { section: "QUICK_TASKS", enabled: true },
];

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/auth/memberships/m2/app-access", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/auth/memberships/[membershipId]/app-access", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      sessionId: "session-1",
      userId: "u1",
      email: "owner@example.com",
      userStatus: "ACTIVE",
      activeCompanyId: "c1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "OWNER",
      status: "ACTIVE",
      permissions: [],
      appAccess: [{ module: "USER_MANAGEMENT", enabled: true, level: "ADMIN" }],
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      role: "USER",
      status: "ACTIVE",
      companyId: "c1",
      userId: "u2",
    });

    mocks.countMock.mockResolvedValue(1);
    mocks.upsertMock.mockResolvedValue(undefined);
    mocks.dashboardSectionUpsertMock.mockResolvedValue(undefined);
    mocks.permissionDeleteManyMock.mockResolvedValue({ count: 0 });
    mocks.permissionCreateManyMock.mockResolvedValue({ count: 0 });

    mocks.transactionMock.mockImplementation(async (callback) => {
      return callback({
        membershipAppAccess: { upsert: mocks.upsertMock },
        membershipDashboardSection: { upsert: mocks.dashboardSectionUpsertMock },
        membershipPermission: {
          deleteMany: mocks.permissionDeleteManyMock,
          createMany: mocks.permissionCreateManyMock,
        },
      });
    });
  });

  it("returns 401 when no session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const res = await PATCH(buildRequest({ appAccess: FULL_ACCESS }), {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(401);
    expect(mocks.findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns 403 when actor lacks USER_MANAGEMENT access", async () => {
    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "USER",
      status: "ACTIVE",
      permissions: [],
      appAccess: [],
    });

    const res = await PATCH(buildRequest({ appAccess: FULL_ACCESS }), {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(403);
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_INPUT when the access matrix is missing a module", async () => {
    const res = await PATCH(buildRequest({ appAccess: FULL_ACCESS.slice(1) }), {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "INVALID_INPUT" });
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the target membership is not in the actor's company", async () => {
    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      role: "USER",
      status: "ACTIVE",
      companyId: "other-company",
      userId: "u2",
    });

    const res = await PATCH(buildRequest({ appAccess: FULL_ACCESS }), {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(404);
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("returns 403 when ADMIN tries to edit an OWNER's access", async () => {
    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "ADMIN",
      status: "ACTIVE",
      permissions: [],
      appAccess: [{ module: "USER_MANAGEMENT", enabled: true, level: "ADMIN" }],
    });

    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      role: "OWNER",
      status: "ACTIVE",
      companyId: "c1",
      userId: "u2",
    });

    const res = await PATCH(buildRequest({ appAccess: FULL_ACCESS }), {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(403);
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("blocks removing the last USER_MANAGEMENT admin in the company", async () => {
    mocks.countMock.mockResolvedValue(0);

    const disablingUserManagement = FULL_ACCESS.map((row) =>
      row.module === "USER_MANAGEMENT" ? { ...row, enabled: false } : row,
    );

    const res = await PATCH(buildRequest({ appAccess: disablingUserManagement }), {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "CANNOT_REMOVE_LAST_USER_MANAGEMENT_ADMIN",
    });

    expect(mocks.countMock).toHaveBeenCalledWith({
      where: {
        module: "USER_MANAGEMENT",
        enabled: true,
        level: "ADMIN",
        membershipId: { not: "m2" },
        membership: { companyId: "c1", status: "ACTIVE" },
      },
    });

    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("also blocks downgrading the last USER_MANAGEMENT admin to Viewer", async () => {
    mocks.countMock.mockResolvedValue(0);

    const downgrading = FULL_ACCESS.map((row) =>
      row.module === "USER_MANAGEMENT" ? { ...row, level: "VIEWER" } : row,
    );

    const res = await PATCH(buildRequest({ appAccess: downgrading }), {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "CANNOT_REMOVE_LAST_USER_MANAGEMENT_ADMIN",
    });
  });

  it("allows removing USER_MANAGEMENT admin when another admin remains", async () => {
    mocks.countMock.mockResolvedValue(1);

    const disablingUserManagement = FULL_ACCESS.map((row) =>
      row.module === "USER_MANAGEMENT" ? { ...row, enabled: false } : row,
    );

    const res = await PATCH(buildRequest({ appAccess: disablingUserManagement }), {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(200);
    expect(mocks.transactionMock).toHaveBeenCalledTimes(1);
  });

  it("upserts every module row and derives legacy permissions from the matrix", async () => {
    const res = await PATCH(buildRequest({ appAccess: FULL_ACCESS }), {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(mocks.upsertMock).toHaveBeenCalledTimes(7);
    expect(mocks.upsertMock).toHaveBeenCalledWith({
      where: { membershipId_module: { membershipId: "m2", module: "ARCHIVE" } },
      create: { membershipId: "m2", module: "ARCHIVE", enabled: true, level: "ADMIN" },
      update: { enabled: true, level: "ADMIN" },
    });

    expect(mocks.permissionDeleteManyMock).toHaveBeenCalledWith({
      where: { membershipId: "m2" },
    });

    expect(mocks.permissionCreateManyMock).toHaveBeenCalledWith({
      data: [
        { membershipId: "m2", permission: "BOOKING_VIEW" },
        { membershipId: "m2", permission: "BOOKING_CREATE" },
        { membershipId: "m2", permission: "ARCHIVE_VIEW" },
      ],
    });
  });

  it("returns 400 INVALID_INPUT when dashboardSections is present but incomplete", async () => {
    const res = await PATCH(
      buildRequest({ appAccess: FULL_ACCESS, dashboardSections: FULL_DASHBOARD_SECTIONS.slice(1) }),
      { params: Promise.resolve({ membershipId: "m2" }) },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "INVALID_INPUT" });
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("writes dashboardSections when the actor is an Owner", async () => {
    const res = await PATCH(
      buildRequest({ appAccess: FULL_ACCESS, dashboardSections: FULL_DASHBOARD_SECTIONS }),
      { params: Promise.resolve({ membershipId: "m2" }) },
    );

    expect(res.status).toBe(200);
    expect(mocks.dashboardSectionUpsertMock).toHaveBeenCalledTimes(5);
    expect(mocks.dashboardSectionUpsertMock).toHaveBeenCalledWith({
      where: { membershipId_section: { membershipId: "m2", section: "GDPR" } },
      create: { membershipId: "m2", section: "GDPR", enabled: false },
      update: { enabled: false },
    });
  });

  it("silently ignores dashboardSections from a non-owner actor instead of rejecting the whole request", async () => {
    mocks.getActiveMembershipMock.mockResolvedValue({
      userId: "u1",
      companyId: "c1",
      role: "ADMIN",
      status: "ACTIVE",
      permissions: [],
      appAccess: [{ module: "USER_MANAGEMENT", enabled: true, level: "ADMIN" }],
    });

    // Target's current USER_MANAGEMENT grant must match the submitted row
    // unchanged (isAppAccessGrantAllowedForNonOwner) — unrelated to this
    // test's actual point (dashboardSections gets silently dropped).
    mocks.findUniqueMock.mockResolvedValue({
      id: "m2",
      role: "USER",
      status: "ACTIVE",
      companyId: "c1",
      userId: "u2",
      appAccess: [{ module: "USER_MANAGEMENT", enabled: true, level: "ADMIN" }],
    });

    const viewerOnlyAccess = FULL_ACCESS.map((row) =>
      row.module === "USER_MANAGEMENT" || row.module === "BOOKING" ? row : { ...row, enabled: false, level: "VIEWER" },
    );

    const res = await PATCH(
      buildRequest({ appAccess: viewerOnlyAccess, dashboardSections: FULL_DASHBOARD_SECTIONS }),
      { params: Promise.resolve({ membershipId: "m2" }) },
    );

    expect(res.status).toBe(200);
    expect(mocks.dashboardSectionUpsertMock).not.toHaveBeenCalled();
  });

  it("omitting dashboardSections entirely leaves it untouched (not an error)", async () => {
    const res = await PATCH(buildRequest({ appAccess: FULL_ACCESS }), {
      params: Promise.resolve({ membershipId: "m2" }),
    });

    expect(res.status).toBe(200);
    expect(mocks.dashboardSectionUpsertMock).not.toHaveBeenCalled();
  });
});
