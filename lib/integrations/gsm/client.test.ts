import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

async function loadClient() {
  vi.resetModules();
  return import("@/lib/integrations/gsm/client");
}

describe("getGsmToken", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GSM_USERNAME", "user");
    vi.stubEnv("GSM_PASSWORD", "pass");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses GSM_API_KEY directly without calling /authenticate/", async () => {
    vi.stubEnv("GSM_API_KEY", "api-key-123");
    const { getGsmToken } = await loadClient();

    await expect(getGsmToken()).resolves.toBe("api-key-123");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the API key as a Token authorization header in gsmFetch", async () => {
    vi.stubEnv("GSM_API_KEY", "api-key-123");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "task-1" }), { status: 200 }),
    );
    const { gsmFetch } = await loadClient();

    await gsmFetch("/tasks/task-1/");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/tasks/task-1/");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Token api-key-123",
    );
  });

  it("falls back to username/password login when no API key is set", async () => {
    vi.stubEnv("GSM_API_KEY", "");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ token: "login-token" }), { status: 200 }),
    );
    const { getGsmToken } = await loadClient();

    await expect(getGsmToken()).resolves.toBe("login-token");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/authenticate/");
  });

  it("includes GSM's status and error body when login fails", async () => {
    vi.stubEnv("GSM_API_KEY", "");
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ non_field_errors: ["Integrations should use an API key"] }),
        { status: 400 },
      ),
    );
    const { getGsmToken } = await loadClient();

    await expect(getGsmToken()).rejects.toThrow(
      /GSM authentication failed \(400\).*Integrations should use an API key/,
    );
  });
});
