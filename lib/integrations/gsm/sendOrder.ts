// path: lib/integrations/gsm/sendOrder.ts
import { gsmFetch } from "@/lib/integrations/gsm/client";
import {
  buildOrderPayload,
  type GsmOrderInput,
} from "@/lib/integrations/gsm/buildOrderPayload";

type GsmCreateOrderResponse = {
  id?: string;
  order?: {
    id?: string;
    tasks?: string[];
  };
  tasks?: string[];
};

type GsmSentTask = {
  gsmTaskId: string;
  category: "pick_up" | "drop_off" | "assignment" | null;
  reference: string;
  // The address as GSM has it; matches a pick-up task to its pickup stop
  // (lib/integrations/gsm/receiptUploads.ts). null when GSM returns none.
  rawAddress: string | null;
};

function isTaskCategory(value: unknown): value is GsmSentTask["category"] {
  return value === "pick_up" || value === "drop_off" || value === "assignment";
}

function extractTaskIdFromUrl(taskUrl: string) {
  const match = taskUrl.match(/\/tasks\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

export async function sendOrderToGsm(order: GsmOrderInput) {
  const payload = buildOrderPayload(order);

  const response = await gsmFetch<GsmCreateOrderResponse>("/orders/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const gsmOrderId = response.order?.id || response.id;

  if (!gsmOrderId) {
    throw new Error("GSM order id missing from response");
  }

  const taskUrls = response.order?.tasks || response.tasks || [];

  const taskIds = taskUrls
    .filter((taskUrl): taskUrl is string => typeof taskUrl === "string")
    .map(extractTaskIdFromUrl)
    .filter((taskId): taskId is string => taskId !== null);

  // GSM does not return tasks in payload order, so each task's category is
  // read back from GSM instead of matched by position against tasks_data.
  const tasks: GsmSentTask[] = await Promise.all(
    taskIds.map(async (gsmTaskId) => {
      const task = await gsmFetch<{ category?: unknown; address?: { raw_address?: unknown } | null }>(
        `/tasks/${encodeURIComponent(gsmTaskId)}/`,
        { method: "GET" },
      );

      return {
        gsmTaskId,
        category: isTaskCategory(task.category) ? task.category : null,
        reference: payload.reference,
        rawAddress: typeof task.address?.raw_address === "string" ? task.address.raw_address : null,
      };
    }),
  );

  return {
    gsmOrderId,
    tasks,
    requestPayload: payload,
    responsePayload: response,
  };
}
