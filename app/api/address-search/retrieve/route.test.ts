import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/address-search/retrieve", () => {
  const fetchMock = vi.fn();
  const originalMapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    process.env.MAPBOX_ACCESS_TOKEN = "test-mapbox-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    if (typeof originalMapboxToken === "string") {
      process.env.MAPBOX_ACCESS_TOKEN = originalMapboxToken;
      return;
    }

    delete process.env.MAPBOX_ACCESS_TOKEN;
  });

  it("returns 400 when id is missing", async () => {
    const response = await GET(
      new Request("http://localhost/api/address-search/retrieve?sessionToken=session-123"),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "ID_REQUIRED" });
  });

  it("returns 500 when the Mapbox token is missing", async () => {
    delete process.env.MAPBOX_ACCESS_TOKEN;

    const response = await GET(
      new Request("http://localhost/api/address-search/retrieve?id=address.1&sessionToken=session-123"),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "MAPBOX_ACCESS_TOKEN_MISSING",
    });
  });

  it("retrieves the coordinate for a suggestion id from Search Box", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [10.7522, 59.9139] },
              properties: { name: "Karl Johans gate 1" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const response = await GET(
      new Request("http://localhost/api/address-search/retrieve?id=address.1&sessionToken=session-123"),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(calledUrl);

    expect(url.origin + url.pathname).toBe(
      "https://api.mapbox.com/search/searchbox/v1/retrieve/address.1",
    );
    expect(url.searchParams.get("session_token")).toBe("session-123");
    expect(url.searchParams.get("access_token")).toBe("test-mapbox-token");
    expect(calledInit).toEqual({ method: "GET", cache: "no-store" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      latitude: 59.9139,
      longitude: 10.7522,
    });
  });

  it("returns 502 when Search Box fails", async () => {
    fetchMock.mockResolvedValue(new Response("upstream failed", { status: 502 }));

    const response = await GET(
      new Request("http://localhost/api/address-search/retrieve?id=address.1&sessionToken=session-123"),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "ADDRESS_RETRIEVE_FAILED" });
  });

  it("returns 502 when Search Box has no coordinate for the id", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET(
      new Request("http://localhost/api/address-search/retrieve?id=address.1&sessionToken=session-123"),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "ADDRESS_RETRIEVE_FAILED" });
  });
});
