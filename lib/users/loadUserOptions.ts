import type { UserOption } from "@/lib/users/types";

type ApiResponseKey = "subcontractors" | "orderCreators";

export async function loadUserOptions(
  url: string,
  responseKey: ApiResponseKey,
): Promise<UserOption[]> {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    return [];
  }

  return data[responseKey] ?? [];
}
