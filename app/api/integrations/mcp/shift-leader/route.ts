import { NextResponse } from "next/server";

import { authenticateMcpRequest } from "@/lib/integrations/mcp/authenticateMcpRequest";
import { prisma } from "@/lib/db";

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authentication = authenticateMcpRequest(request);

  if (!authentication.ok) {
    return NextResponse.json(
      { ok: false, reason: authentication.reason },
      { status: authentication.status },
    );
  }

  try {
    const record = await prisma.shiftLeader.findUnique({
      where: { companyId: authentication.companyId },
    });

    if (!record || record.date !== todayDateString()) {
      return NextResponse.json({ shiftLeader: null });
    }

    return NextResponse.json({
      shiftLeader: { username: record.username },
    });
  } catch (error) {
    console.error("MCP shift-leader lookup failed", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, reason: "SERVICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
