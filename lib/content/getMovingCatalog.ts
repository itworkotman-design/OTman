import { prisma } from "@/lib/db";
import { MOVING_PRICE_LIST_CODE } from "@/lib/content/movingCatalog";

export type MovingCatalogOption = {
  code: string;
  labelEn: string;
  labelNo: string;
  customerPriceCents: number;
  subcontractorPriceCents: number;
};

export type MovingCatalog = {
  priceListId: string;
  options: MovingCatalogOption[];
};

// Shared by the public catalog-fetch route (app/api/site/moving-request/
// catalog/route.ts, for the live price the customer sees while picking a
// size) and the submission route (app/api/site/moving-request/route.ts, to
// re-resolve that same price server-side rather than trusting whatever the
// client sent) — one query, one source of truth for both.
export async function getMovingCatalog(): Promise<MovingCatalog | null> {
  const priceList = await prisma.priceList.findUnique({
    where: { code: MOVING_PRICE_LIST_CODE },
    select: {
      id: true,
      items: {
        select: {
          customerPriceCents: true,
          subcontractorPriceCents: true,
          productOption: {
            select: { code: true, label: true, description: true, sortOrder: true, isActive: true },
          },
        },
      },
    },
  });

  if (!priceList) return null;

  const options = priceList.items
    .filter((item) => item.productOption.isActive)
    .sort((a, b) => a.productOption.sortOrder - b.productOption.sortOrder)
    .map((item) => ({
      code: item.productOption.code,
      labelEn: item.productOption.label ?? item.productOption.code,
      labelNo: item.productOption.description ?? item.productOption.label ?? item.productOption.code,
      customerPriceCents: item.customerPriceCents,
      subcontractorPriceCents: item.subcontractorPriceCents,
    }));

  return { priceListId: priceList.id, options };
}

// Used both to price the client's live selection server-side on submit (see
// app/api/site/moving-request/route.ts) and could back client-side lookups
// too — kept a plain function rather than inlined so it has its own test.
export function findMovingSizeOption(
  options: MovingCatalogOption[],
  code: string | null | undefined,
): MovingCatalogOption | null {
  if (!code) return null;
  return options.find((option) => option.code === code) ?? null;
}
