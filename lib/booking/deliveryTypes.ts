export type DeliveryType =
  | ""
  | "Første trinn"
  | "Innbæring"
  | "Kun Installasjon/Montering"
  | "Kun retur";

export const DELIVERY_TYPE_PRICES: Record<Exclude<DeliveryType, "">, number> = {
  "Første trinn": 590,
  "Innbæring": 669,
  "Kun Installasjon/Montering": 590,
  "Kun retur": 669,
};
