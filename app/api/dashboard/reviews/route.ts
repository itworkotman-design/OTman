import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { requireDashboardSection } from "@/lib/users/requireDashboardSection";

const REVIEWS_BATCH_SIZE = 30;

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  const gate = await requireDashboardSection(session, "REVIEWS");
  if (!gate.ok) return gate.response;

  const cursor = new URL(req.url).searchParams.get("cursor")?.trim() || undefined;
  const reviewRows = await prisma.review.findMany({
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: REVIEWS_BATCH_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = reviewRows.length > REVIEWS_BATCH_SIZE;
  const reviews = reviewRows.slice(0, REVIEWS_BATCH_SIZE);

  return NextResponse.json({
    ok: true,
    reviews,
    hasMore,
    nextCursor: hasMore ? reviews.at(-1)?.id ?? null : null,
  });
}
