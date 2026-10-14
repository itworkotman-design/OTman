import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { MovingCatalogOption } from "@/lib/content/getMovingCatalog";
import type {
  OrderSummaryExtraLine,
  OrderSummaryProduct,
} from "../whiteGoods/WhiteGoodsOrderSummary";

// The moving flow's live calculator reuses the delivery modal's order-summary
// card (WhiteGoodsOrderSummary): the move is one "product" — its size line
// (what it's priced on) plus each additional service — and the no-lift floor
// surcharge and the carrying-distance surcharge go under the card's order
// extras, one row per end. Prices are
// ex. VAT in kroner, as the card expects; it applies the VAT mode itself.
export function movingSummary(params: {
  locale: Locale;
  sizeOption: MovingCatalogOption | null;
  services: MovingCatalogOption[];
  // Per end with chargeable floors — line totals (per floor × floors), as
  // built by movingFloorSurchargeLines; `end` is the row's "fra"/"til".
  floorLines: { end: string; quantity: number; customerPriceCents: number }[];
  // Carrying-distance surcharge per end with one (movingCarrySurchargeLines).
  carryLines?: { end: string; labelNo: string; labelEn: string; customerPriceCents: number }[];
  // The driving-distance charge (movingDistanceLines) — `quantity` is the km.
  distanceLines?: { quantity: number; customerPriceCents: number }[];
}): { products: OrderSummaryProduct[]; orderExtras: OrderSummaryExtraLine[] } {
  const no = params.locale === "no";
  const label = (option: MovingCatalogOption) => (no ? option.labelNo : option.labelEn);
  const kr = (cents: number) => Math.round(cents / 100);
  if (!params.sizeOption) return { products: [], orderExtras: [] };

  const lines = [
    { label: label(params.sizeOption), price: kr(params.sizeOption.customerPriceCents), qty: 1, category: "delivery" as const },
    ...params.services.map((service) => ({
      label: label(service),
      price: kr(service.customerPriceCents),
      qty: 1,
      category: "other" as const,
    })),
  ];

  return {
    products: [
      {
        cardId: 0,
        name: no ? "Flytting" : "Moving",
        subtitle: label(params.sizeOption),
        code: "MOVING_BY_SIZE",
        iconKey: "fn_sofa",
        qty: 1,
        total: lines.reduce((sum, line) => sum + line.price, 0),
        lines,
      },
    ],
    orderExtras: [
      ...params.floorLines.map((line) => ({
        label: `${no ? "Etasjetillegg" : "Floor surcharge"}, ${line.end}`,
        price: kr(line.customerPriceCents),
        qty: line.quantity,
      })),
      ...(params.carryLines ?? []).map((line) => ({
        label: `${no ? line.labelNo : line.labelEn}, ${line.end}`,
        price: kr(line.customerPriceCents),
        qty: 1,
      })),
      ...(params.distanceLines ?? []).map((line) => ({
        label: `${no ? "Kjøring" : "Distance"} (${line.quantity} km)`,
        price: kr(line.customerPriceCents),
        qty: line.quantity,
      })),
    ],
  };
}
