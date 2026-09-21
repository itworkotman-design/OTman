import { NextResponse } from "next/server";
import { getWebsiteCatalogPart, listSeededWebsiteCatalogs } from "@/lib/content/websiteOrderCatalog";
import { WEBSITE_CATALOGS } from "@/lib/content/websiteCatalogs";

// Public, unauthenticated catalog fetch for the website order flow, scoped to
// exactly one website price list per request (`?list=<price list code>`,
// default: the first, white goods) — kept separate from the dashboard's
// /api/booking/catalog so this flow doesn't share anything with the internal
// booking flow. Also reports which website lists are available (seeded) so the
// UI can offer "any other products?" without hard-coding them.
export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get("list") ?? WEBSITE_CATALOGS[0].priceListCode;

  const [seeded, part] = await Promise.all([listSeededWebsiteCatalogs(), getWebsiteCatalogPart(requested)]);

  if (!part) {
    return NextResponse.json({ ok: false, reason: "UNKNOWN_LIST" }, { status: 404 });
  }

  // The order-level fees and special options always come from the FIRST list
  // (white goods), whichever list the customer starts with or adds — the same
  // rule the order route applies when it merges the lists.
  const firstCode = seeded[0]?.catalog.priceListCode;
  const feesPart = !firstCode || firstCode === requested ? part : ((await getWebsiteCatalogPart(firstCode)) ?? part);

  return NextResponse.json(
    {
      ok: true,
      priceListCode: requested,
      priceListId: part.priceListId,
      products: part.products,
      specialOptions: feesPart.specialOptions,
      priceListSettings: feesPart.priceListSettings,
      availableLists: seeded.map(({ catalog }) => ({
        code: catalog.priceListCode,
        labelEn: catalog.labelEn,
        labelNo: catalog.labelNo,
      })),
    },
    { status: 200 },
  );
}
