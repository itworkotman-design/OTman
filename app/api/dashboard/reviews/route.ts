import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { requireDashboardSection } from "@/lib/users/requireDashboardSection";

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  const gate = await requireDashboardSection(session, "REVIEWS");
  if (!gate.ok) return gate.response;

  const reviews = await prisma.review.findMany({
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  return NextResponse.json({ ok: true, reviews });
}
