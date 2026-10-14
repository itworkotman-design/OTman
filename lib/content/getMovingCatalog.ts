import { prisma } from "@/lib/db";
import {
  MOVING_FLOOR_SURCHARGE_PRODUCT_CODE,
  MOVING_PRICE_LIST_CODE,
  MOVING_SERVICES_PRODUCT_CODE,
} from "@/lib/content/movingCatalog";

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
  // Additional services (MOVING_SERVICES_PRODUCT_CODE), same shape, kept apart
  // from the size brackets so they never show up as a size tile.
  services: MovingCatalogOption[];
  // Price per chargeable floor with no lift (MOVING_FLOOR_SURCHARGE_PRODUCT_CODE);
  // null until seeded, which means no floor surcharge is charged.
  floorSurcharge: MovingCatalogOption | null;
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
            select: {
              code: true,
              label: true,
              description: true,
              sortOrder: true,
              isActive: true,
              product: { select: { code: true } },
            },
          },
        },
      },
    },
  });

  if (!priceList) return null;

  const active = priceList.items
    .filter((item) => item.productOption.isActive)
    .sort((a, b) => a.productOption.sortOrder - b.productOption.sortOrder);
  const productCode = (item: (typeof active)[number]) => item.productOption.product?.code;
  const isService = (item: (typeof active)[number]) => productCode(item) === MOVING_SERVICES_PRODUCT_CODE;
  const isFloorSurcharge = (item: (typeof active)[number]) => productCode(item) === MOVING_FLOOR_SURCHARGE_PRODUCT_CODE;
  const toOption = (item: (typeof active)[number]): MovingCatalogOption => ({
    code: item.productOption.code,
    labelEn: item.productOption.label ?? item.productOption.code,
    labelNo: item.productOption.description ?? item.productOption.label ?? item.productOption.code,
    customerPriceCents: item.customerPriceCents,
    subcontractorPriceCents: item.subcontractorPriceCents,
  });

  return {
    priceListId: priceList.id,
    options: active.filter((item) => !isService(item) && !isFloorSurcharge(item)).map(toOption),
    services: active.filter(isService).map(toOption),
    floorSurcharge: active.filter(isFloorSurcharge).map(toOption)[0] ?? null,
  };
}

// Resolves the submitted additional-service codes against the catalog, in
// catalog order. Missing → none (clients from before the services step);
// anything that isn't a list of distinct, known codes → null (reject).
export function findMovingServiceOptions(
  services: MovingCatalogOption[],
  codes: unknown,
): MovingCatalogOption[] | null {
  if (codes === undefined || codes === null) return [];
  if (!Array.isArray(codes) || !codes.every((code) => typeof code === "string")) return null;
  if (new Set(codes).size !== codes.length) return null;
  if (!codes.every((code) => services.some((service) => service.code === code))) return null;
  return services.filter((service) => codes.includes(service.code));
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
