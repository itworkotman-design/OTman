import { NextResponse } from "next/server";

type SearchBoxFeature = {
  geometry?: {
    coordinates?: unknown;
  };
};

type SearchBoxRetrieveResponse = {
  features?: SearchBoxFeature[];
};

function parseCoordinatePair(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const [longitude, latitude] = value;

  return typeof longitude === "number" && typeof latitude === "number"
    ? [longitude, latitude]
    : null;
}

// Companion to /api/address-search: Mapbox's Search Box `/suggest` endpoint
// (used there) never returns coordinates, only a `/retrieve/{mapbox_id}` call
// against the same session does — so a selected suggestion needs this second
// call to learn where it actually is before we can pin it for GSM instead of
// leaving GSM to re-geocode our address text on its own.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim() ?? "";

  if (!id) {
    return NextResponse.json({ ok: false, reason: "ID_REQUIRED" }, { status: 400 });
  }

  const sessionToken = searchParams.get("sessionToken")?.trim() || crypto.randomUUID();
  const token = process.env.MAPBOX_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json(
      { ok: false, reason: "MAPBOX_ACCESS_TOKEN_MISSING" },
      { status: 500 },
    );
  }

  const url = new URL(`https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(id)}`);
  url.searchParams.set("session_token", sessionToken);
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const data = (await res.json().catch(() => null)) as SearchBoxRetrieveResponse | null;

  if (!res.ok || !data) {
    return NextResponse.json({ ok: false, reason: "ADDRESS_RETRIEVE_FAILED" }, { status: 502 });
  }

  const coordinate = parseCoordinatePair(data.features?.[0]?.geometry?.coordinates);

  if (!coordinate) {
    return NextResponse.json({ ok: false, reason: "ADDRESS_RETRIEVE_FAILED" }, { status: 502 });
  }

  const [longitude, latitude] = coordinate;

  return NextResponse.json({ ok: true, latitude, longitude });
}
