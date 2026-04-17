import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/address-search", () => {
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

  it("returns no results for short queries without calling Mapbox", async () => {
    const response = await GET(
      new Request("http://localhost/api/address-search?q=os"),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      results: [],
    });
  });

  it("returns 500 when the Mapbox token is missing", async () => {
    delete process.env.MAPBOX_ACCESS_TOKEN;

    const response = await GET(
      new Request("http://localhost/api/address-search?q=ikea"),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "MAPBOX_ACCESS_TOKEN_MISSING",
    });
  });

  it("returns business and address suggestions from Search Box", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          suggestions: [
            {
              mapbox_id: "poi.1",
              name: "IKEA Furuset",
              feature_type: "poi",
              full_address: "Strandveien 1, 1366 Lysaker, Norway",
              place_formatted: "Oslo, Norway",
            },
            {
              mapbox_id: "address.1",
              name: "Karl Johans gate 1",
              feature_type: "address",
              full_address: "Karl Johans gate 1, 0154 Oslo, Norway",
              place_formatted: "Oslo, Norway",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/address-search?q=ikea&sessionToken=session-123",
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    const url = new URL(calledUrl);

    expect(url.origin + url.pathname).toBe(
      "https://api.mapbox.com/search/searchbox/v1/suggest",
    );
    expect(url.searchParams.get("q")).toBe("ikea");
    expect(url.searchParams.get("session_token")).toBe("session-123");
    expect(url.searchParams.get("types")).toBe("poi,address,street");
    expect(url.searchParams.get("country")).toBe("NO");
    expect(calledInit).toEqual({
      method: "GET",
      cache: "no-store",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      results: [
        {
          id: "poi.1",
          label: "Strandveien 1, 1366 Lysaker, Norway",
          name: "IKEA Furuset",
          subtitle: "Strandveien 1, 1366 Lysaker, Norway",
          featureType: "poi",
        },
        {
          id: "address.1",
          label: "Karl Johans gate 1, 0154 Oslo, Norway",
          name: "Karl Johans gate 1",
          subtitle: "Oslo, Norway",
          featureType: "address",
        },
      ],
    });
  });

  it("returns 502 when Search Box fails", async () => {
    fetchMock.mockResolvedValue(
      new Response("upstream failed", {
        status: 502,
      }),
    );

    const response = await GET(
      new Request("http://localhost/api/address-search?q=ikea"),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "ADDRESS_LOOKUP_FAILED",
    });
  });
});
