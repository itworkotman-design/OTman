import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  syncGmailOrderConversationsMock: vi.fn(),
}));

vi.mock("@/lib/email/gmailSync", () => ({
  syncGmailOrderConversations: mocks.syncGmailOrderConversationsMock,
}));

import { POST } from "./route";

describe("POST /api/integrations/gmail/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the Gmail sync and returns the result", async () => {
    mocks.syncGmailOrderConversationsMock.mockResolvedValue({
      imported: 1,
      skippedDuplicates: 2,
      tokenNotFound: 3,
      orderNotFound: 4,
    });

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: {
        imported: 1,
        skippedDuplicates: 2,
        tokenNotFound: 3,
        orderNotFound: 4,
      },
    });
    expect(mocks.syncGmailOrderConversationsMock).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when Gmail sync fails", async () => {
    mocks.syncGmailOrderConversationsMock.mockRejectedValue(
      new Error("Gmail unavailable"),
    );

    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "Gmail unavailable",
    });
  });
});
