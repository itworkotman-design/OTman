import { NextResponse } from "next/server";

import { authenticateMcpRequest } from "@/lib/integrations/mcp/authenticateMcpRequest";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const authentication = authenticateMcpRequest(request);

  if (!authentication.ok) {
    return NextResponse.json(
      { ok: false, reason: authentication.reason },
      { status: authentication.status },
    );
  }

  try {
    // Company-wide MCP access returns every active address, matching the
    // full-access (Owner/Admin) view in the staff UI rather than any single
    // user's assigned subset.
    const pickupAddresses = await prisma.customPickupAddress.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { name: true, address: true, latitude: true, longitude: true, phone: true },
    });

    return NextResponse.json({ pickupAddresses });
  } catch (error) {
    console.error("MCP pickup-addresses lookup failed", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, reason: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
