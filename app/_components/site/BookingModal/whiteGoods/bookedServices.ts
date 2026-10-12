import type { CatalogProduct, SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_UPGRADES } from "@/lib/orders/customerOrderEditPolicy";
import { findWebsiteProductSeed } from "@/lib/content/websiteCatalogs";
import { groupDismantlingOptions } from "./optionGroups";

// Within 24h of the job, "My order" only lets a customer add services to a
// product (lib/orders/customerOrderEditPolicy.ts): what's booked stays, and
// the delivery type can only move up (doorstep → carry-in). The product card
// runs every change through keepBookedServices, so a click that would drop a
// booked service (or the card's own clearing on a delivery-type switch) can't.

export function allowedDeliveryTypes(booked: SavedProductCard): string[] {
  return [booked.deliveryType, ...(DELIVERY_UPGRADES[booked.deliveryType] ?? [])];
}

export function isBookedService(booked: SavedProductCard, optionId: string): boolean {
  return (
    booked.selectedInstallOptionIds.includes(optionId) ||
    booked.selectedExtraOptionIds.includes(optionId) ||
    booked.selectedReturnOptionId === optionId
  );
}

function withBooked(booked: string[], next: string[]): string[] {
  return [...booked.filter((id) => !next.includes(id)), ...next];
}

export function keepBookedServices(booked: SavedProductCard, next: SavedProductCard): SavedProductCard {
  return {
    ...next,
    deliveryType: allowedDeliveryTypes(booked).includes(next.deliveryType) ? next.deliveryType : booked.deliveryType,
    selectedInstallOptionIds: withBooked(booked.selectedInstallOptionIds, next.selectedInstallOptionIds),
    selectedExtraOptionIds: withBooked(booked.selectedExtraOptionIds, next.selectedExtraOptionIds),
    selectedReturnOptionId: booked.selectedReturnOptionId ?? next.selectedReturnOptionId,
    demontEnabled: booked.demontEnabled || next.demontEnabled,
  };
}

// Whether the booked card still has an "Additional services" row to tick —
// the same rows WhiteGoodsProductCard shows for its delivery and installation
// as booked. "My order" within 24h only shows the cards where it does.
export function hasAddableServices(product: CatalogProduct, booked: SavedProductCard): boolean {
  if (booked.deliveryType === "") return false;
  const option = (code: string) => product.options.find((o) => o.code === code) ?? null;
  const notBooked = (id: string | undefined) => !!id && !isBookedService(booked, id);

  const showExtras = booked.selectedInstallOptionIds.length === 0;
  const seeds = findWebsiteProductSeed(product.code)?.options ?? [];
  const returnOption = product.options.find((o) => seeds.some((s) => s.code === o.code && s.category === "return"));
  const isFurniture = product.code.startsWith("FN_");
  const anchoring = product.options.find((o) => o.active && o.code === "WALL_ANCHORING");
  const dismantlingGroups = groupDismantlingOptions(product.options, "no");

  return (
    (showExtras && notBooked(option("UNPACKING")?.id)) ||
    (showExtras && !!option("DEMONT") && !booked.demontEnabled) ||
    (showExtras && notBooked(option("PALLET_PICKUP")?.id)) ||
    (isFurniture &&
      dismantlingGroups.some((g) => !isBookedService(booked, g.disposal?.id ?? "") && !isBookedService(booked, g.careful?.id ?? ""))) ||
    (isFurniture && notBooked(anchoring?.id)) ||
    (!!returnOption && !booked.selectedReturnOptionId)
  );
}
