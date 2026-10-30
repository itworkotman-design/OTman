import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gsmFetchMock: vi.fn(),
  buildOrderPayloadMock: vi.fn(),
}));

vi.mock("@/lib/integrations/gsm/client", () => ({
  gsmFetch: mocks.gsmFetchMock,
}));

vi.mock("@/lib/integrations/gsm/buildOrderPayload", () => ({
  buildOrderPayload: mocks.buildOrderPayloadMock,
}));

import { sendOrderToGsm } from "./sendOrder";
import type { GsmOrderInput } from "./buildOrderPayload";

describe("sendOrderToGsm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildOrderPayloadMock.mockReturnValue({
      reference: "ID1",
      tasks_data: [{ category: "pick_up" }, { category: "assignment" }],
    });
  });

  it("takes each task's category from GSM, not from its position in the payload", async () => {
    mocks.gsmFetchMock.mockImplementation(async (path: string) => {
      if (path === "/orders/") {
        return {
          id: "gsm-order-1",
          // GSM does not return tasks in payload order.
          tasks: [
            "https://api.gsmtasks.com/tasks/assignment-task/",
            "https://api.gsmtasks.com/tasks/pickup-task/",
          ],
        };
      }
      if (path === "/tasks/assignment-task/") return { category: "assignment" };
      if (path === "/tasks/pickup-task/") return { category: "pick_up" };
      throw new Error(`unexpected path ${path}`);
    });

    const result = await sendOrderToGsm({} as GsmOrderInput);

    expect(result.tasks).toEqual([
      { gsmTaskId: "assignment-task", category: "assignment", reference: "ID1" },
      { gsmTaskId: "pickup-task", category: "pick_up", reference: "ID1" },
    ]);
  });

  it("falls back to null when GSM returns an unknown category", async () => {
    mocks.gsmFetchMock.mockImplementation(async (path: string) => {
      if (path === "/orders/") {
        return { id: "gsm-order-1", tasks: ["https://api.gsmtasks.com/tasks/t1/"] };
      }
      return { category: "something_else" };
    });

    const result = await sendOrderToGsm({} as GsmOrderInput);

    expect(result.tasks[0].category).toBeNull();
  });
});
