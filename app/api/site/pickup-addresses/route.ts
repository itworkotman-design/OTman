import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public, unauthenticated read of the active saved pickup locations (store
// branches, partner warehouses, …) so the public booking flow can surface a
// name/address match ahead of a plain Mapbox search — see
// PickupAddressAutocomplete. Deliberately minimal beyond icon/color (shown
// as the row's badge): no phone or coordinates — those stay dashboard-only
// (see /api/pickup-addresses/available for the staff-authenticated, full
// version).
export async function GET() {
  const addresses = await prisma.customPickupAddress.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      icon: true,
      color: true,
    },
  });

  return NextResponse.json({ ok: true, addresses }, { status: 200 });
}
