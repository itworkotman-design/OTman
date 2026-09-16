import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retrieveAddressCoordinate } from "@/lib/orders/retrieveAddressCoordinate";

describe("retrieveAddressCoordinate", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("returns null without calling fetch when the session token is empty", async () => {
    const result = await retrieveAddressCoordinate("mapbox-id", "");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("fetches the retrieve endpoint and returns the coordinate", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, latitude: 59.9139, longitude: 10.7522 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await retrieveAddressCoordinate("mapbox-id", "session-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/address-search/retrieve?id=mapbox-id&sessionToken=session-123",
      { credentials: "include" },
    );
    expect(result).toEqual({ latitude: 59.9139, longitude: 10.7522 });
  });

  it("returns null when the response is not ok", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, reason: "ADDRESS_RETRIEVE_FAILED" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await retrieveAddressCoordinate("mapbox-id", "session-123");

    expect(result).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await retrieveAddressCoordinate("mapbox-id", "session-123");

    expect(result).toBeNull();
  });
});
