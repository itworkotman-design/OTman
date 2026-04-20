import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getRouteDistance } from "@/lib/integrations/mapbox/routeDistance";

type RouteDistanceRequestBody = {
  pickupAddress?: unknown;
  extraPickupAddresses?: unknown;
  deliveryAddress?: unknown;
  returnAddress?: unknown;
};

function toOptionalString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | RouteDistanceRequestBody
    | null;

  if (!body) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_BODY" },
      { status: 400 },
    );
  }

  try {
    const result = await getRouteDistance({
      pickupAddress: toOptionalString(body.pickupAddress),
      extraPickupAddresses: toStringArray(body.extraPickupAddresses),
      deliveryAddress: toOptionalString(body.deliveryAddress),
      returnAddress: toOptionalString(body.returnAddress),
    });

    return NextResponse.json({
      ok: true,
      distanceKm: result?.distanceKm ?? "",
      stopAddresses: result?.stopAddresses ?? [],
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.message
        ? error.message
        : "ROUTE_DISTANCE_FAILED";

    const status = reason === "MAPBOX_ACCESS_TOKEN_MISSING" ? 500 : 502;

    return NextResponse.json(
      { ok: false, reason },
      { status },
    );
  }
}
