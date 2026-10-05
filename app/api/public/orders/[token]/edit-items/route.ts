import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrderByActionToken } from "@/lib/orders/publicOrderAccess";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { getWebsiteOrderCatalog } from "@/lib/content/websiteOrderCatalog";
import { validateOrderItemEdits } from "@/lib/orders/validateOrderItemEdits";
import { createOrderUpdatedEvent } from "@/lib/orders/orderEvents";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import {
  ItemNameRequiredError,
  SizeBracketSelectionError,
  recomputeWebsiteOrderPricing,
  websiteOrderPricingWrites,
} from "@/lib/orders/websiteOrderRepricing";
import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

// "Forgot something?" — a customer on an already-confirmed (paid) order can
// reconfigure an existing product's delivery type/addons and pay the
// difference, without staff mediation, because the change is narrow enough
// to auto-price safely: it can only pick among already-known catalog prices
// for products already in the order (validateOrderItemEdits enforces this
// server-side, not just as a UI restriction) — never add a new product, a
// case still deliberately staff-mediated. See
// docs/homepage-ordering-roadmap.md §4.
//
// Re-priced through the same pipeline that created the order (see
// lib/orders/websiteOrderRepricing.ts), so the new total is consistent with
// how the order was priced originally. Order-level context (driving
// distance, express delivery, floors, lift, extra pickups) is preserved from
// the order as it already exists — only the per-card inputs change.
//
// A change that would DECREASE the total is rejected outright: refunding a
// partial payment is a materially different feature (money going back out,
// not in) that nothing here builds — see the roadmap doc's own note on this.

class PriceWouldDecreaseError extends Error {
  constructor() {
    super("This change would reduce the order total");
  }
}

// GET — fetches the order's existing cards + the current live catalog, so
// the client can render each product's delivery-type/addon choices exactly
// like the original booking flow did.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByActionToken(token);

  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  if (normalizeOrderStatus(order.status) !== "confirmed") {
    return NextResponse.json({ ok: false, reason: "NOT_ELIGIBLE" }, { status: 409 });
  }

  const productCards = Array.isArray(order.productCardsSnapshot) ? order.productCardsSnapshot : [];
  if (productCards.length === 0) {
    return NextResponse.json({ ok: false, reason: "NO_EDITABLE_ITEMS" }, { status: 409 });
  }

  try {
    const catalog = await getWebsiteOrderCatalog();
    return NextResponse.json({
      ok: true,
      displayId: order.displayId,
      productsSummary: order.productsSummary,
      productCards,
      catalogProducts: catalog.products,
      catalogSpecialOptions: catalog.specialOptions,
      priceListSettings: catalog.priceListSettings,
    });
  } catch (err) {
    console.error("[edit-items] Failed to load catalog:", err);
    return NextResponse.json({ ok: false, reason: "CATALOG_UNAVAILABLE" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: { productCards?: unknown } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "INVALID_BODY" }, { status: 400 });
  }

  const submittedCards = Array.isArray(body?.productCards) ? (body!.productCards as SavedProductCard[]) : null;
  if (!submittedCards || submittedCards.length === 0) {
    return NextResponse.json({ ok: false, reason: "INVALID_BODY" }, { status: 400 });
  }

  const order = await getOrderByActionToken(token);
  if (!order) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  if (normalizeOrderStatus(order.status) !== "confirmed") {
    return NextResponse.json({ ok: false, reason: "NOT_ELIGIBLE" }, { status: 409 });
  }

  const originalCards = Array.isArray(order.productCardsSnapshot) ? (order.productCardsSnapshot as unknown as SavedProductCard[]) : [];
  if (originalCards.length === 0) {
    return NextResponse.json({ ok: false, reason: "NO_EDITABLE_ITEMS" }, { status: 409 });
  }

  const validation = validateOrderItemEdits(originalCards, submittedCards);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, reason: validation.reason }, { status: 422 });
  }

  try {
    const recomputed = await recomputeWebsiteOrderPricing(order, submittedCards);
    const previousPriceExVat = order.priceExVat;

    if (recomputed.priceExVat < previousPriceExVat) {
      throw new PriceWouldDecreaseError();
    }

    await prisma.$transaction(
      websiteOrderPricingWrites(order, recomputed, {
        needsNotificationAttention: true,
        lastNotificationAt: new Date(),
      }),
    );

    await createOrderUpdatedEvent(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      actor: { source: "SYSTEM", name: "Customer" },
      changes: [
        {
          field: "priceExVat",
          label: "Price (ex VAT)",
          previousValue: String(previousPriceExVat),
          nextValue: String(recomputed.priceExVat),
        },
      ],
    });

    // The alert for staff — same in-app notification pattern every other
    // website-order flow this session uses.
    const deltaExVat = recomputed.priceExVat - previousPriceExVat;
    await createOrderNotification(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      type: "MANUAL_REVIEW",
      title: `Customer updated order #${order.displayId}`,
      message:
        deltaExVat > 0
          ? `Customer changed delivery/addon selections on their order — total increased by ${deltaExVat} kr (ex VAT). They'll be prompted to pay the difference.`
          : `Customer changed delivery/addon selections on their order — total is unchanged.`,
    });

    return NextResponse.json({
      ok: true,
      previousPriceExVat,
      newPriceExVat: recomputed.priceExVat,
      deltaExVat,
    });
  } catch (err) {
    if (err instanceof PriceWouldDecreaseError) {
      return NextResponse.json({ ok: false, reason: "WOULD_DECREASE_PRICE" }, { status: 422 });
    }
    if (err instanceof SizeBracketSelectionError) {
      return NextResponse.json({ ok: false, reason: "SIZE_BRACKETS_REQUIRED" }, { status: 422 });
    }
    if (err instanceof ItemNameRequiredError) {
      return NextResponse.json({ ok: false, reason: "ITEM_NAME_REQUIRED" }, { status: 422 });
    }
    console.error("[edit-items] Failed to apply order item edits:", err);
    return NextResponse.json({ ok: false, reason: "UPDATE_FAILED" }, { status: 500 });
  }
}
