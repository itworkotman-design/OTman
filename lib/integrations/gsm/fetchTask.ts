// path: lib/integrations/gsm/fetchTask.ts
import { gsmFetch } from "@/lib/integrations/gsm/client";

export async function fetchGsmTask(taskId: string) {
  return gsmFetch<Record<string, unknown>>(
    `/tasks/${encodeURIComponent(taskId)}/`,
    {
      method: "GET",
    },
  );
}
