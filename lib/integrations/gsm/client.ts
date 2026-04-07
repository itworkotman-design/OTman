// path: lib/integrations/gsm/client.ts
const GSM_API_BASE = process.env.GSM_API_BASE ?? "https://api.gsmtasks.com";
const GSM_API_VERSION =
  process.env.GSM_API_VERSION ?? "application/json; version=2.4.36";

let cachedToken: { value: string; expiresAt: number } | null = null;

export  async function getGsmToken() {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.value;
  }

  const username = process.env.GSM_USERNAME;
  const password = process.env.GSM_PASSWORD;

  if (!username || !password) {
    throw new Error("Missing GSM credentials");
  }

  const res = await fetch(`${GSM_API_BASE}/authenticate/`, {
    method: "POST",
    headers: {
      Accept: GSM_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.token) {
    throw new Error("GSM authentication failed");
  }

  cachedToken = {
    value: data.token,
    expiresAt: now + 50 * 60 * 1000,
  };

  return data.token as string;
}



export async function gsmFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getGsmToken();

  const res = await fetch(`${GSM_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: GSM_API_VERSION,
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      "Accept-Timezone": "Europe/Oslo",
      ...(init?.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("GSM ERROR STATUS:", res.status);
    console.error("GSM ERROR BODY:", data);

    throw new Error(
      JSON.stringify(data) || `GSM request failed (${res.status})`,
    );
  }

  return data as T;
}
