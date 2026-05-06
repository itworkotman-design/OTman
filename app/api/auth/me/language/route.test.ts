import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  userUpdateMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      update: mocks.userUpdateMock,
    },
  },
}));

import { PATCH } from "./route";

describe("PATCH /api/auth/me/language", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userUpdateMock.mockResolvedValue({ id: "user-1" });
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const res = await PATCH(
      new Request("http://localhost/api/auth/me/language", {
        method: "PATCH",
        body: JSON.stringify({ languagePreference: "NO" }),
      }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
    expect(mocks.userUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects invalid languages", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
    });

    const res = await PATCH(
      new Request("http://localhost/api/auth/me/language", {
        method: "PATCH",
        body: JSON.stringify({ languagePreference: "DE" }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "INVALID_LANGUAGE",
    });
    expect(mocks.userUpdateMock).not.toHaveBeenCalled();
  });

  it("saves the selected language on the current user", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
    });

    const res = await PATCH(
      new Request("http://localhost/api/auth/me/language", {
        method: "PATCH",
        body: JSON.stringify({ languagePreference: "EN" }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      languagePreference: "EN",
    });
    expect(mocks.userUpdateMock).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      data: {
        languagePreference: "EN",
      },
    });
  });
});
