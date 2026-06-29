import { NextResponse } from "next/server";
import { getRouteDistance } from "@/lib/integrations/mapbox/routeDistance";

const _rl = { lastAt: 0 };

type RequestBody = {
  pickupAddress?: unknown;
  extraPickupAddresses?: unknown;
  deliveryAddress?: unknown;
};

export async function POST(req: Request) {
  const now = Date.now();
  if (now - _rl.lastAt < 1000) {
    return NextResponse.json({ ok: false, reason: "RATE_LIMIT" }, { status: 429 });
  }
  _rl.lastAt = now;

  const body = (await req.json().catch(() => null)) as RequestBody | null;
  if (!body) {
    return NextResponse.json({ ok: false, reason: "INVALID_BODY" }, { status: 400 });
  }

  const pickupAddress = typeof body.pickupAddress === "string" ? body.pickupAddress.trim().slice(0, 300) : "";
  const deliveryAddress = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim().slice(0, 300) : "";
  const extraPickupAddresses = Array.isArray(body.extraPickupAddresses)
    ? body.extraPickupAddresses
        .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        .map((a) => a.trim().slice(0, 300))
        .slice(0, 5)
    : [];

  if (!pickupAddress || !deliveryAddress) {
    return NextResponse.json({ ok: false, reason: "MISSING_ADDRESSES" }, { status: 400 });
  }

  try {
    const result = await getRouteDistance({ pickupAddress, extraPickupAddresses, deliveryAddress });
    return NextResponse.json({ ok: true, distanceKm: result?.distanceKm ?? "" });
  } catch (error) {
    const reason = error instanceof Error && error.message ? error.message : "ROUTE_DISTANCE_FAILED";
    const status = reason === "MAPBOX_ACCESS_TOKEN_MISSING" ? 500 : 502;
    return NextResponse.json({ ok: false, reason }, { status });
  }
}
