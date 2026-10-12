import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { DELIVERY_UPGRADES } from "@/lib/orders/customerOrderEditPolicy";

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
