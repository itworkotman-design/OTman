import { prisma } from "@/lib/db";

const CACHE_TTL_MS = 2 * 24 * 60 * 60 * 1000;

// Raw status strings stored in the DB that mean "cancelled" or "failed"
const EXCLUDED_STATUSES = ["cancelled", "kanselert", "avbrutt", "failed", "fail", "feilet"];

const KM_FALLBACK_PER_ORDER = 20;

export type SiteStats = {
  productsInstalled: number;
  kmDriven: number;
  ordersCompleted: number;
};

async function computeSiteStats(): Promise<SiteStats> {
  const [productSum, orders] = await Promise.all([
    prisma.orderItem.aggregate({
      _sum: { quantity: true },
      where: { itemType: "PRODUCT_CARD" },
    }),
    prisma.order.findMany({
      where: { status: { notIn: EXCLUDED_STATUSES } },
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
  const cached = await prisma.siteStats.findUnique({ where: { id: "main" } });

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
    where: { id: "main" },
    create: { id: "main", ...fresh },
    update: fresh,
  });

  return fresh;
}
