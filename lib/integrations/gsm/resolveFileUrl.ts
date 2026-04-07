// path: lib/integrations/gsm/resolveFileUrl.ts
import { gsmFetch } from "@/lib/integrations/gsm/client";

type GsmFileResource = {
  file?: string;
  file_name?: string;
};

export async function resolveGsmFileUrl(resourceUrl: string) {
  const resource = await gsmFetch<GsmFileResource>(
    resourceUrl.replace("https://api.gsmtasks.com", ""),
    { method: "GET" },
  );

  if (!resource.file) {
    throw new Error("GSM file URL missing on resource");
  }

  return {
    fileUrl: resource.file,
    fileName: resource.file_name ?? null,
  };
}
