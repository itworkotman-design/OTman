import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getRouteDistance } from "@/lib/integrations/mapbox/routeDistance";
import { getVisibleCustomPickupAddress } from "@/lib/pickupAddresses/visibility";

type RouteDistanceRequestBody = {
  pickupAddress?: unknown;
  customPickupAddressId?: unknown;
  extraPickupAddresses?: unknown;
  deliveryAddress?: unknown;
  returnAddress?: unknown;
  customReturnAddressId?: unknown;
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

  let pickupAddress = toOptionalString(body.pickupAddress);
  let pickupCoordinate: { latitude: number; longitude: number } | undefined;

  if (typeof body.customPickupAddressId === "string" && body.customPickupAddressId) {
    if (!session.activeCompanyId) {
      return NextResponse.json(
        { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
        { status: 409 },
      );
    }

    const customPickupAddress = await getVisibleCustomPickupAddress(
      body.customPickupAddressId,
      session.userId,
      session.activeCompanyId,
    );

    if (!customPickupAddress) {
      return NextResponse.json(
        { ok: false, reason: "PICKUP_ADDRESS_NOT_AVAILABLE" },
        { status: 403 },
      );
    }

    pickupAddress = customPickupAddress.address;
    pickupCoordinate = {
      latitude: customPickupAddress.latitude,
      longitude: customPickupAddress.longitude,
    };
  }

  let returnAddress = toOptionalString(body.returnAddress);
  let returnCoordinate: { latitude: number; longitude: number } | undefined;

  if (typeof body.customReturnAddressId === "string" && body.customReturnAddressId) {
    if (!session.activeCompanyId) {
      return NextResponse.json(
        { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
        { status: 409 },
      );
    }

    const customReturnAddress = await getVisibleCustomPickupAddress(
      body.customReturnAddressId,
      session.userId,
      session.activeCompanyId,
    );

    if (!customReturnAddress) {
      return NextResponse.json(
        { ok: false, reason: "RETURN_ADDRESS_NOT_AVAILABLE" },
        { status: 403 },
      );
    }

    returnAddress = customReturnAddress.address;
    returnCoordinate = {
      latitude: customReturnAddress.latitude,
      longitude: customReturnAddress.longitude,
    };
  }

  try {
    const result = await getRouteDistance({
      pickupAddress,
      pickupCoordinate,
      extraPickupAddresses: toStringArray(body.extraPickupAddresses),
      deliveryAddress: toOptionalString(body.deliveryAddress),
      returnAddress,
      returnCoordinate,
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
