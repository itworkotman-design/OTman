import { CUSTOM_DEVIATION_CODE, DEVIATION_FEE_OPTIONS } from "@/lib/booking/pricing/deviationFees";
import {
  getPricingSnapshotCustomDeviationDescription,
  getPricingSnapshotCustomDeviationPrice,
  getPricingSnapshotCustomDeviationSubcontractorPrice,
} from "./orderTotals";
import { validateTextField } from "./websiteOrderValidation";

// The fields of a homepage website order only an admin handles (never the
// customer), edited straight in WebsiteOrderModal: driver(s), info for the
// driver, license plate, deviation fee, "don't send email", the internal
// description, express delivery, discount and extra. Express, discount,
// extra and the deviation change the price, so a save re-prices the order
// (PUT /api/orders/[orderId]/website-items with `handling`).

export type WebsiteOrderHandling = {
  driver: string;
  secondDriver: string;
  driverInfo: string;
  licensePlate: string;
  // "" or a DEVIATION_FEE_OPTIONS englishLabel.
  deviation: string;
  // Only for the custom deviation: its own prices and description.
  customDeviation: { price: number | null; subcontractorPrice: number | null; description: string | null };
  dontSendEmail: boolean;
  description: string;
  expressDelivery: boolean;
  // Kroner as a plain number string ("" = none), like Order.rabatt/leggTil.
  rabatt: string;
  leggTil: string;
};

const CUSTOM_LABEL = DEVIATION_FEE_OPTIONS.find((o) => o.code === CUSTOM_DEVIATION_CODE)?.englishLabel ?? "Custom";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function kroner(value: unknown): string | null {
  const raw = typeof value === "number" ? String(value) : text(value).replace(",", ".");
  if (!raw) return "";
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? raw : null;
}

function price(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(typeof value === "string" ? value.replace(",", ".") : value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export type ParsedWebsiteOrderHandling =
  | { ok: true; handling: WebsiteOrderHandling }
  | { ok: false; reason: "INVALID_HANDLING"; errors: Record<string, string> };

export function parseWebsiteOrderHandling(raw: unknown): ParsedWebsiteOrderHandling {
  const v = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const errors: Record<string, string> = {};

  const handling: WebsiteOrderHandling = {
    driver: text(v.driver),
    secondDriver: text(v.secondDriver),
    driverInfo: text(v.driverInfo),
    licensePlate: text(v.licensePlate),
    deviation: text(v.deviation),
    customDeviation: { price: null, subcontractorPrice: null, description: null },
    dontSendEmail: v.dontSendEmail === true,
    description: text(v.description),
    expressDelivery: v.expressDelivery === true,
    rabatt: "",
    leggTil: "",
  };

  for (const field of ["driver", "secondDriver", "driverInfo", "licensePlate", "description"] as const) {
    if (validateTextField(handling[field])) errors[field] = "Contains disallowed characters";
  }

  const rabatt = kroner(v.rabatt);
  if (rabatt === null) errors.rabatt = "Must be an amount in kroner";
  else handling.rabatt = rabatt;
  const leggTil = kroner(v.leggTil);
  if (leggTil === null) errors.leggTil = "Must be an amount in kroner";
  else handling.leggTil = leggTil;

  if (handling.deviation && !DEVIATION_FEE_OPTIONS.some((o) => o.englishLabel === handling.deviation)) {
    errors.deviation = "Unknown deviation";
  }
  if (handling.deviation === CUSTOM_LABEL) {
    const custom = v.customDeviation && typeof v.customDeviation === "object" ? (v.customDeviation as Record<string, unknown>) : {};
    handling.customDeviation = {
      price: price(custom.price),
      subcontractorPrice: price(custom.subcontractorPrice),
      description: text(custom.description) || null,
    };
  }

  if (Object.keys(errors).length > 0) return { ok: false, reason: "INVALID_HANDLING", errors };
  return { ok: true, handling };
}

// The order columns these fields live in.
export function handlingOrderData(handling: WebsiteOrderHandling) {
  return {
    driver: handling.driver || null,
    secondDriver: handling.secondDriver || null,
    driverInfo: handling.driverInfo || null,
    licensePlate: handling.licensePlate || null,
    deviation: handling.deviation || null,
    dontSendEmail: handling.dontSendEmail,
    description: handling.description || null,
    expressDelivery: handling.expressDelivery,
    rabatt: handling.rabatt || null,
    leggTil: handling.leggTil || null,
  };
}

// The panel's starting values, from the order.
export function handlingFromOrder(order: {
  driver: string | null;
  secondDriver: string | null;
  driverInfo: string | null;
  licensePlate: string | null;
  deviation: string | null;
  dontSendEmail: boolean;
  description: string | null;
  expressDelivery: boolean;
  rabatt: string | null;
  leggTil: string | null;
  pricingSnapshot: unknown;
}): WebsiteOrderHandling {
  const isCustom = order.deviation === CUSTOM_LABEL;
  return {
    driver: order.driver ?? "",
    secondDriver: order.secondDriver ?? "",
    driverInfo: order.driverInfo ?? "",
    licensePlate: order.licensePlate ?? "",
    deviation: order.deviation ?? "",
    customDeviation: {
      price: isCustom ? getPricingSnapshotCustomDeviationPrice(order.pricingSnapshot) : null,
      subcontractorPrice: isCustom ? getPricingSnapshotCustomDeviationSubcontractorPrice(order.pricingSnapshot) : null,
      description: isCustom ? getPricingSnapshotCustomDeviationDescription(order.pricingSnapshot) : null,
    },
    dontSendEmail: order.dontSendEmail === true,
    description: order.description ?? "",
    expressDelivery: order.expressDelivery === true,
    rabatt: order.rabatt ?? "",
    leggTil: order.leggTil ?? "",
  };
}

const PRICE_FIELDS = ["expressDelivery", "rabatt", "leggTil", "deviation"] as const;

// Whether the panel has unsaved changes, and whether they move the price
// (express, discount, extra, deviation) — those get a price preview.
export function handlingChange(
  initial: WebsiteOrderHandling,
  next: WebsiteOrderHandling,
): { changed: boolean; affectsPrice: boolean } {
  const affectsPrice =
    PRICE_FIELDS.some((field) => initial[field] !== next[field]) ||
    JSON.stringify(initial.customDeviation) !== JSON.stringify(next.customDeviation);
  const changed = affectsPrice || JSON.stringify(initial) !== JSON.stringify(next);
  return { changed, affectsPrice };
}
