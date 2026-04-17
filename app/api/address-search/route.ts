import { NextResponse } from "next/server";

type SearchBoxSuggestion = {
  mapbox_id: string;
  name: string;
  feature_type: "poi" | "address" | "street" | string;
  full_address?: string;
  address?: string;
  place_formatted?: string;
};

function buildSuggestionSubtitle(suggestion: SearchBoxSuggestion) {
  if (suggestion.feature_type === "poi") {
    return (
      suggestion.full_address ??
      [suggestion.address, suggestion.place_formatted]
        .filter(Boolean)
        .join(", ")
    );
  }

  return suggestion.place_formatted ?? "";
}

function buildSuggestionLabel(suggestion: SearchBoxSuggestion) {
  const addressLabel =
    suggestion.full_address ||
    [suggestion.address, suggestion.place_formatted]
      .filter(Boolean)
      .join(", ");

  return addressLabel || suggestion.name;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const sessionToken =
    searchParams.get("sessionToken")?.trim() || crypto.randomUUID();

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

  const url = new URL("https://api.mapbox.com/search/searchbox/v1/suggest");
  url.searchParams.set("q", q);
  url.searchParams.set("access_token", token);
  url.searchParams.set("session_token", sessionToken);
  url.searchParams.set("limit", "5");
  url.searchParams.set("language", "no");
  url.searchParams.set("country", "NO");
  url.searchParams.set("types", "poi,address,street");

  const res = await fetch(url.toString(), {
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

  const suggestions = Array.isArray(data.suggestions)
    ? (data.suggestions as SearchBoxSuggestion[])
    : [];

  const results = suggestions.map((suggestion) => ({
    id: suggestion.mapbox_id,
    label: buildSuggestionLabel(suggestion),
    name: suggestion.name,
    subtitle: buildSuggestionSubtitle(suggestion),
    featureType: suggestion.feature_type,
  }));

  return NextResponse.json({
    ok: true,
    results,
  });
}
