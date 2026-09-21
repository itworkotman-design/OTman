import { prisma } from "@/lib/db";
import { getBookingCatalog } from "@/lib/booking/catalog/getBookingCatalog";
import { mergeWebsiteCatalogs, type MergedWebsiteCatalog, type WebsiteCatalogPart } from "@/lib/content/mergeWebsiteCatalogs";
import { WEBSITE_CATALOGS, type WebsiteCatalog } from "@/lib/content/websiteCatalogs";

// Server side of the website order flow's catalogs. Website only — the
// dashboard booking flow keeps using getBookingCatalog directly.

export type SeededWebsiteCatalog = { catalog: WebsiteCatalog; priceListId: string };

// The registry catalogs whose price list has actually been seeded in this
// environment, in registry order — so a not-yet-seeded list is simply not
// offered instead of breaking the whole flow.
export async function listSeededWebsiteCatalogs(): Promise<SeededWebsiteCatalog[]> {
  const rows = await prisma.priceList.findMany({
    where: { code: { in: WEBSITE_CATALOGS.map((c) => c.priceListCode) }, isActive: true },
    select: { id: true, code: true },
  });
  const idByCode = new Map(rows.map((r) => [r.code, r.id]));

  return WEBSITE_CATALOGS.flatMap((catalog) => {
    const priceListId = idByCode.get(catalog.priceListCode);
    return priceListId ? [{ catalog, priceListId }] : [];
  });
}

async function loadPart({ catalog, priceListId }: SeededWebsiteCatalog): Promise<WebsiteCatalogPart> {
  const full = await getBookingCatalog(priceListId);
  // getBookingCatalog returns every active Product regardless of price list
  // (only option prices are list-scoped) — keep just this list's own products
  // so no dashboard product or other list's product leaks in at 0 kr.
  const codes = new Set(catalog.products.map((p) => p.code));
  return {
    priceListId,
    products: full.products.filter((p) => codes.has(p.code)),
    specialOptions: full.specialOptions,
    priceListSettings: full.priceListSettings,
  };
}

export async function getWebsiteCatalogPart(priceListCode: string): Promise<WebsiteCatalogPart | null> {
  const seeded = (await listSeededWebsiteCatalogs()).find((s) => s.catalog.priceListCode === priceListCode);
  return seeded ? loadPart(seeded) : null;
}

// Every seeded website list merged into the one catalog the shared calculator
// prices from. The first registry list (white goods) must exist: it supplies
// the order-level fees and special options.
export async function getWebsiteOrderCatalog(): Promise<MergedWebsiteCatalog> {
  const seeded = await listSeededWebsiteCatalogs();
  const first = WEBSITE_CATALOGS[0];
  if (seeded[0]?.catalog.priceListCode !== first.priceListCode) {
    throw new Error(`PriceList with code "${first.priceListCode}" not found — run the seed script`);
  }
  return mergeWebsiteCatalogs(await Promise.all(seeded.map(loadPart)));
}
