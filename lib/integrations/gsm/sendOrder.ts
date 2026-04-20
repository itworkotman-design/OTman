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
};

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

  const tasksWithNullableIds: Array<{
    gsmTaskId: string | null;
    category: "pick_up" | "drop_off" | "assignment" | null;
    reference: string;
  }> = taskUrls
    .filter((taskUrl): taskUrl is string => typeof taskUrl === "string")
    .map((taskUrl, index) => ({
      gsmTaskId: extractTaskIdFromUrl(taskUrl),
      category: payload.tasks_data[index]?.category ?? null,
      reference: payload.reference,
    }));

  const tasks: GsmSentTask[] = tasksWithNullableIds.filter(
    (task): task is GsmSentTask => task.gsmTaskId !== null,
  );

  return {
    gsmOrderId,
    tasks,
    requestPayload: payload,
    responsePayload: response,
  };
}
