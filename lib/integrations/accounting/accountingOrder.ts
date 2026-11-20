import { Prisma } from "@prisma/client";

import type { OrderRow } from "@/app/_components/Dahsboard/booking/archive/types";

import {
  getEffectiveArchiveCustomerTotal,
  getEffectiveArchiveSubcontractorTotal,
} from "@/lib/booking/archiveColumns";
import { buildArchiveCalculatorItems } from "@/lib/orders/buildArchiveCalculatorItems";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

/** What the accounting API reads of an order: the booking export's money columns and who they belong to. */
export const accountingOrderSelect = Prisma.validator<Prisma.OrderSelect>()({
  id: true,
  displayId: true,
  status: true,
  deliveryDate: true,
  priceExVat: true,
  priceSubcontractor: true,
  pricingSnapshot: true,
  rabatt: true,
  leggTil: true,
  subcontractorMinus: true,
  subcontractorPlus: true,
  websiteOrderKind: true,
  isWebsiteOrder: true,
  productCardsSnapshot: true,
  items: {
    select: {
      cardId: true,
      productCode: true,
      productName: true,
      deliveryType: true,
      itemType: true,
      optionCode: true,
      optionLabel: true,
      quantity: true,
      customerPriceCents: true,
      subcontractorPriceCents: true,
      rawData: true,
    },
  },
  subcontractor: true,
  subcontractorMembershipId: true,
  priceListId: true,
  createdByMembershipId: true,
  customerMembershipId: true,
  createdByMembership: { select: { user: { select: { username: true, email: true } } } },
  customerMembership: { select: { user: { select: { username: true, email: true } } } },
  updatedAt: true,
});

export type AccountingOrderRecord = Prisma.OrderGetPayload<{ select: typeof accountingOrderSelect }>;

export type AccountingOrder = {
  id: string;
  displayId: number;
  /** Normalized ("completed", "invoiced", "cancelled"…), as in the archive. */
  status: string;
  /** "YYYY-MM-DD" as stored; null when the order has none. */
  deliveryDate: string | null;
  store: { id: string; name: string };
  partner: { id: string | null; name: string } | null;
  priceList: { id: string; name: string } | null;
  /** The export's "Price ex. VAT", in øre. */
  priceExVatCents: number;
  /** The export's "Partner price", in øre. */
  partnerPriceCents: number;
  isWebsiteOrder: boolean;
  updatedAt: string;
};

export type AccountingOrderContext = {
  priceListNames: Map<string, string>;
};

/** An account's display name: its username, else its email (as the archive shows it). */
export function membershipUserLabel(user: { username: string | null; email: string } | null | undefined): string {
  if (!user) return "";
  return user.username?.trim() || user.email.trim();
}

const toCents = (kr: number) => Math.round(kr * 100);

/**
 * One order as the accounting app reads it. The store follows the archive's
 * "Store" column (app/api/orders/route.ts): the assigned store, else the account
 * that created the order. The prices are
 * the export's own totals (lib/booking/archiveColumns.ts), so an API import and
 * a file import of the same orders give the same amounts.
 */
export function toAccountingOrder(order: AccountingOrderRecord, context: AccountingOrderContext): AccountingOrder {
  const status = normalizeOrderStatus(order.status);
  // The archive gets these same items through its JSON response, typed as OrderRow; the totals read only their
  // option codes, quantities and prices.
  const calculatorItems = buildArchiveCalculatorItems({
    orderItems: order.items,
    productCardsSnapshot: order.productCardsSnapshot,
  }) as OrderRow["calculatorItems"];
  const totalsRow = {
    status,
    priceExVat: order.priceExVat,
    priceSubcontractor: order.priceSubcontractor,
    pricingSnapshot: order.pricingSnapshot,
    rabatt: order.rabatt ?? "",
    leggTil: order.leggTil ?? "",
    subcontractorMinus: order.subcontractorMinus ?? "",
    subcontractorPlus: order.subcontractorPlus ?? "",
    calculatorItems,
    websiteOrderKind: order.websiteOrderKind,
  };

  const assigned = order.customerMembershipId ? membershipUserLabel(order.customerMembership?.user) : "";
  const store =
    order.customerMembershipId && assigned
      ? { id: order.customerMembershipId, name: assigned }
      : { id: order.createdByMembershipId, name: membershipUserLabel(order.createdByMembership.user) };

  const partnerName = order.subcontractor?.trim() ?? "";
  const partner = partnerName || order.subcontractorMembershipId ? { id: order.subcontractorMembershipId, name: partnerName } : null;

  return {
    id: order.id,
    displayId: order.displayId,
    status,
    deliveryDate: order.deliveryDate?.trim() || null,
    store,
    partner,
    priceList: order.priceListId ? { id: order.priceListId, name: context.priceListNames.get(order.priceListId) ?? "" } : null,
    priceExVatCents: toCents(getEffectiveArchiveCustomerTotal(totalsRow)),
    partnerPriceCents: toCents(getEffectiveArchiveSubcontractorTotal(totalsRow)),
    isWebsiteOrder: order.isWebsiteOrder,
    updatedAt: order.updatedAt.toISOString(),
  };
}
