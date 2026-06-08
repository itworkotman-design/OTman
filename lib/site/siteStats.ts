import { prisma } from "@/lib/db";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Bump this when the query logic changes to invalidate any stale cached row
const CACHE_ID = "main-v3";

// Raw status strings stored in the DB that mean "cancelled" or "failed"
const EXCLUDED_STATUSES = ["cancelled", "kanselert", "avbrutt", "failed", "fail", "feilet"];

const KM_FALLBACK_PER_ORDER = 20;

// ---------------------------------------------------------------------------
// Pre-2026 historical totals — set these manually by running the SQL queries
// in the plan file. The live query below adds only the current calendar year
// on top of these numbers.
// ---------------------------------------------------------------------------
export const HISTORICAL_BASELINE = {
  productsInstalled: 3660,
  kmDriven: 27518,
  ordersCompleted: 2429,
};

export type SiteStats = {
  productsInstalled: number;
  kmDriven: number;
  ordersCompleted: number;
};

async function computeSiteStats(): Promise<SiteStats> {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  // Shared filter: current calendar year, excluding cancelled/failed.
  // OR [null] is required because Prisma's `notIn` silently drops null-status rows.
  const activeOrderWhere = {
    OR: [
      { status: null },
      { status: { notIn: EXCLUDED_STATUSES } },
    ],
    createdAt: { gte: yearStart },
  };

  const [productSum, orders] = await Promise.all([
    prisma.orderItem.aggregate({
      _sum: { quantity: true },
      where: { itemType: "PRODUCT_CARD", order: activeOrderWhere },
    }),
    prisma.order.findMany({
      where: activeOrderWhere,
      select: { drivingDistance: true },
    }),
  ]);

  const productsInstalled = Math.round(productSum._sum.quantity ?? 0);

  let kmDriven = 0;
  for (const order of orders) {
    const parsed = parseFloat(order.drivingDistance ?? "");
    kmDriven += Number.isFinite(parsed) && parsed > 0 ? parsed : KM_FALLBACK_PER_ORDER;
  }

  return {
    productsInstalled,
    kmDriven: Math.round(kmDriven),
    ordersCompleted: orders.length,
  };
}

export async function getOrRefreshSiteStats(): Promise<SiteStats> {
  const cached = await prisma.siteStats.findUnique({ where: { id: CACHE_ID } });

  const isStale = !cached || Date.now() - cached.updatedAt.getTime() > CACHE_TTL_MS;

  if (!isStale && cached) {
    return {
      productsInstalled: cached.productsInstalled,
      kmDriven: cached.kmDriven,
      ordersCompleted: cached.ordersCompleted,
    };
  }

  const fresh = await computeSiteStats();

  await prisma.siteStats.upsert({
    where: { id: CACHE_ID },
    create: { id: CACHE_ID, ...fresh },
    update: fresh,
  });

  return fresh;
}
