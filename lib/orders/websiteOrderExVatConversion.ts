import { parseNokAdjustment } from "./orderTotals";
import type { OrderPricingSnapshot as CatalogPricingSnapshot } from "@/lib/booking/pricing/snapshot";

// One-time conversion of a homepage (WHITE_GOODS) order stored before website
// prices became ex. VAT: back then every customer amount was stored incl. VAT
// (what the customer saw and paid). Each one is divided by 1.25, and the old
// total becomes the snapshot's totalIncVat — so the customer is charged
// exactly what they were before (getOrderChargeAmountIncVatNok), and payment
// comparisons (built incl. VAT per line) match their old payment snapshots.
// Partner amounts were always ex. VAT and are left alone. Run by
// scripts/convert-website-orders-to-ex-vat.ts.

const VAT_FACTOR = 1.25;

type Json = Record<string, unknown>;

export type OldWebsiteOrder = {
  websiteOrderKind: string | null;
  priceExVat: number;
  rabatt: string | null;
  leggTil: string | null;
  pricingSnapshot: unknown;
  websiteBookingDetails: unknown;
  productCardsSnapshot: unknown;
  items: { id: string; customerPriceCents: number | null }[];
};

export type ConvertedWebsiteOrder =
  | { skip: "ALREADY_EX_VAT" | "NOT_A_WEBSITE_ORDER" }
  | {
      skip?: undefined;
      order: {
        priceExVat: number;
        rabatt: string | null;
        leggTil: string | null;
        pricingSnapshot: Json;
        websiteBookingDetails: unknown;
        productCardsSnapshot: unknown;
        priceSubcontractor?: undefined;
      };
      items: { id: string; customerPriceCents: number }[];
      // Fields whose incl.-VAT amount didn't divide evenly by 1.25 (rounded to øre).
      inexact: string[];
    };

const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function convertWebsiteOrderToExVat(order: OldWebsiteOrder): ConvertedWebsiteOrder {
  if (order.websiteOrderKind !== "WHITE_GOODS") return { skip: "NOT_A_WEBSITE_ORDER" };
  const snapshot = isRecord(order.pricingSnapshot) ? order.pricingSnapshot : null;
  if (snapshot?.vatBasis === "exVat") return { skip: "ALREADY_EX_VAT" };

  const inexact = new Set<string>();
  // Kroner amounts to øre.
  const exVat = (amount: number, field: string) => {
    const value = Math.round((amount / VAT_FACTOR) * 100) / 100;
    if (Math.abs(value * VAT_FACTOR - amount) > 0.001) inexact.add(field);
    return value;
  };
  const exVatOptional = (amount: unknown, field: string) => (isNum(amount) ? exVat(amount, field) : amount);
  const exVatText = (text: string | null, field: string) => {
    if (!text?.trim()) return text;
    const amount = parseNokAdjustment(text);
    return amount ? String(exVat(amount, field)) : text;
  };

  // What the customer was charged before: the snapshot's (incl.) total.
  const oldCustomer = isRecord(snapshot?.customer) ? snapshot.customer : {};
  const chargedIncVat = isNum(oldCustomer.totalExVat) ? oldCustomer.totalExVat : order.priceExVat;
  const totalExVat = exVat(chargedIncVat, "pricingSnapshot.customer.totalExVat");

  const pricingSnapshot: Json = {
    ...(snapshot ?? { version: 1 }),
    vatBasis: "exVat",
    customer: {
      ...oldCustomer,
      subtotalExVat: exVatOptional(oldCustomer.subtotalExVat, "pricingSnapshot.customer.subtotalExVat"),
      discount: exVatOptional(oldCustomer.discount, "pricingSnapshot.customer.discount"),
      extra: exVatOptional(oldCustomer.extra, "pricingSnapshot.customer.extra"),
      totalExVat,
      vat: Math.round((chargedIncVat - totalExVat) * 100) / 100,
      totalIncVat: chargedIncVat,
    },
    ...(isNum(snapshot?.customDeviationPrice)
      ? { customDeviationPrice: exVat(snapshot.customDeviationPrice, "pricingSnapshot.customDeviationPrice") }
      : {}),
    ...(Array.isArray(snapshot?.lines)
      ? {
          lines: snapshot.lines.map((line: unknown, i) =>
            isRecord(line)
              ? {
                  ...line,
                  customerUnitPrice: exVatOptional(line.customerUnitPrice, `pricingSnapshot.lines[${i}]`),
                  customerLineTotal: exVatOptional(line.customerLineTotal, `pricingSnapshot.lines[${i}]`),
                }
              : line,
          ),
        }
      : {}),
  };

  const details = isRecord(order.websiteBookingDetails) ? order.websiteBookingDetails : null;
  const websiteBookingDetails =
    details && Array.isArray(details.orderExtras)
      ? {
          ...details,
          // shownTotal stays: it was, and still is, the incl.-VAT total the customer saw.
          orderExtras: details.orderExtras.map((extra: unknown, i) =>
            isRecord(extra) ? { ...extra, price: exVatOptional(extra.price, `orderExtras[${i}]`) } : extra,
          ),
        }
      : order.websiteBookingDetails;

  // The cards' saved catalog prices were incl. VAT — dropped; the order's own
  // (converted) lines are what resolveSavedCatalogPricing reads them back from.
  const productCardsSnapshot = Array.isArray(order.productCardsSnapshot)
    ? order.productCardsSnapshot.map((card: unknown) => (isRecord(card) ? { ...card, pricingSnapshot: null } : card))
    : order.productCardsSnapshot;

  const items = order.items
    .filter((item): item is { id: string; customerPriceCents: number } => isNum(item.customerPriceCents) && item.customerPriceCents !== 0)
    .map((item) => {
      const cents = Math.round(item.customerPriceCents / VAT_FACTOR);
      if (cents * VAT_FACTOR !== item.customerPriceCents) inexact.add(`items.${item.id}`);
      return { id: item.id, customerPriceCents: cents };
    });

  const priceExVat = Math.round(order.priceExVat / VAT_FACTOR);
  if (priceExVat * VAT_FACTOR !== order.priceExVat) inexact.add("priceExVat");

  return {
    order: {
      priceExVat,
      rabatt: exVatText(order.rabatt, "rabatt"),
      leggTil: exVatText(order.leggTil, "leggTil"),
      pricingSnapshot,
      websiteBookingDetails,
      productCardsSnapshot,
    },
    items,
    inexact: [...inexact],
  };
}

// A catalog snapshot from when the website's catalog numbers meant incl. VAT,
// as ex. VAT: every customer price ÷ 1.25 (to øre); partner prices, labels and
// everything else unchanged. resolveSavedCatalogPricing tries it for orders
// converted by convertWebsiteOrderToExVat, whose cards lost their snapshot.
export function catalogCustomerPricesExVat(snapshot: CatalogPricingSnapshot): CatalogPricingSnapshot {
  const scale = (price: string) => {
    const n = Number(String(price).trim().replace(",", "."));
    return Number.isFinite(n) && String(price).trim() !== "" ? String(Math.round((n / VAT_FACTOR) * 100) / 100) : price;
  };
  const mapValues = <T,>(record: Record<string, T>, fn: (value: T) => T) =>
    Object.fromEntries(Object.entries(record).map(([key, value]) => [key, fn(value)]));
  const settings = snapshot.priceListSettings;
  const charge = <T extends { price: string }>(setting: T): T => ({ ...setting, price: scale(setting.price) });
  return {
    ...snapshot,
    productOptions: mapValues(snapshot.productOptions, (o) => ({ ...o, customerPrice: scale(o.customerPrice), effectiveCustomerPrice: scale(o.effectiveCustomerPrice) })),
    specialOptions: mapValues(snapshot.specialOptions, (o) => ({ ...o, customerPrice: scale(o.customerPrice), effectiveCustomerPrice: scale(o.effectiveCustomerPrice) })),
    deliveryTypes: mapValues(snapshot.deliveryTypes, (d) => ({ ...d, price: scale(d.price), xtraPrice: scale(d.xtraPrice) })),
    autoDeliveryPrices: mapValues(snapshot.autoDeliveryPrices, (a) => ({ ...a, price: scale(a.price) })),
    customSectionOptions: mapValues(snapshot.customSectionOptions, (o) => ({ ...o, price: scale(o.price) })),
    priceListSettings: {
      ...settings,
      extraPickup: charge(settings.extraPickup),
      expressDelivery: charge(settings.expressDelivery),
      xtraPallet: charge(settings.xtraPallet),
      kmFrom21: charge(settings.kmFrom21),
      kmOver100: charge(settings.kmOver100),
      extraWork: charge(settings.extraWork),
      addToOrder: charge(settings.addToOrder),
      floorSurcharge: charge(settings.floorSurcharge),
      deviations: mapValues(settings.deviations ?? {}, charge),
    },
  };
}
