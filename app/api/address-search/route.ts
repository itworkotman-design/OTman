import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 3) {
    return NextResponse.json({
      ok: true,
      results: [],
    });
  }

  const token = process.env.MAPBOX_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json(
      { ok: false, reason: "MAPBOX_ACCESS_TOKEN_MISSING" },
      { status: 500 },
    );
  }

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(q)}.json` +
    `?access_token=${encodeURIComponent(token)}` +
    `&autocomplete=true` +
    `&limit=5` +
    `&language=no` +
    `&country=no`;

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data) {
    return NextResponse.json(
      { ok: false, reason: "ADDRESS_LOOKUP_FAILED" },
      { status: 502 },
    );
  }

  const results = Array.isArray(data.features)
    ? data.features.map((feature: { id: string; place_name: string }) => ({
        id: feature.id,
        label: feature.place_name,
      }))
    : [];

  return NextResponse.json({
    ok: true,
    results,
  });
}
