import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerAccounts/customerSession";
import { customerOrderView, findCustomerOrder } from "@/lib/customerAccounts/customerOrderView";
import { getWebsiteOrderCatalog, listSeededWebsiteCatalogs } from "@/lib/content/websiteOrderCatalog";
import { usesFullDistanceKmPricing } from "@/lib/booking/pricing/distanceCharges";
import { getPricingSnapshotCustomDeviationDescription, getPricingSnapshotCustomDeviationPrice } from "@/lib/orders/orderTotals";
import { movingAdjustmentsFromOrder } from "@/lib/orders/movingOrderCalculator";
import { movingStaffLines } from "@/lib/orders/movingHandlingLines";
import { editCustomerOrder, normalizedCards } from "@/lib/customerAccounts/customerOrderEdit";
import { startPaidChangeCheckout } from "@/lib/customerAccounts/customerOrderPaidChange";

// "My order": a logged-in customer reads (GET) and changes (PUT) their own
// homepage order. The change itself — the 24h policy, re-pricing, saving,
// telling staff and the customer — is lib/customerAccounts/customerOrderEdit.ts.
//
// PUT body (every part optional — what's left out stays as it is):
//   { customer: { name, phone, email, comments }, preferredDate, timeWindow,
//     pickups, delivery, productCards, moving, service, shownTotal, dryRun }
// A change that moves the price needs `shownTotal` = the price the page
// showed (from a dryRun); anything else is refused with the real price, same
// contract as the order POST. A change that makes a PAID order dearer isn't
// saved: it's held and the response carries a Stripe `checkoutUrl` for the
// difference — it's applied once the payment lands
// (lib/customerAccounts/customerOrderPaidChange.ts).

type Params = { params: Promise<{ orderNumber: string }> };

function reject(reason: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, reason, ...extra }, { status });
}

async function load(req: Request, params: Params["params"]) {
  const session = await getCustomerSession(req);
  if (!session) return { ok: false as const, response: reject("UNAUTHORIZED", 401) };
  const { orderNumber } = await params;
  const order = await findCustomerOrder(session.accountId, decodeURIComponent(orderNumber));
  if (!order) return { ok: false as const, response: reject("NOT_FOUND", 404) };
  return { ok: true as const, order, accountId: session.accountId };
}

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const loaded = await load(req, params);
  if (!loaded.ok) return loaded.response;
  const { order } = loaded;

  const view = customerOrderView(order);
  // The white-goods catalog only for a delivery order (a move uses the moving one, loaded by its flow).
  // A move: what staff set on its price, so the flow's live price matches the
  // server's (movingCustomerLiveTotals) — the partner side is left out.
  if (view.details.kind === "moving") {
    const staff = movingAdjustmentsFromOrder(order);
    return NextResponse.json({
      ok: true,
      ...view,
      pricingContext: {
        rabatt: order.rabatt ?? "",
        leggTil: order.leggTil ?? "",
        nulledLineKeys: staff.nulledLines.customer,
        // Express and the deviation staff added, kept as priced.
        staffLines: movingStaffLines(order.items),
      },
    });
  }
  if (!view.permissions.canEditItems || view.details.kind !== "catalog") return NextResponse.json({ ok: true, ...view });

  const [catalog, seeded] = await Promise.all([getWebsiteOrderCatalog(), listSeededWebsiteCatalogs()]);
  const idByCode = new Map(catalog.products.map((p) => [p.code, p.id]));
  return NextResponse.json({
    ok: true,
    ...view,
    productCards: normalizedCards(order.productCardsSnapshot),
    drivingDistance: order.drivingDistance,
    // What else is in the price, so the page's live summary matches the
    // server (staff-set discount/extra/deviation/express). The partner side
    // is left out.
    pricingContext: {
      expressDelivery: order.expressDelivery,
      rabatt: order.rabatt ?? "",
      leggTil: order.leggTil ?? "",
      deviation: order.deviation ?? "",
      customDeviation: {
        price: getPricingSnapshotCustomDeviationPrice(order.pricingSnapshot),
        description: getPricingSnapshotCustomDeviationDescription(order.pricingSnapshot),
      },
      useFullDistanceKmPricing: usesFullDistanceKmPricing(order.createdAt),
    },
    catalog: { products: catalog.products, specialOptions: catalog.specialOptions, priceListSettings: catalog.priceListSettings },
    categories: seeded.map(({ catalog: list }) => ({
      code: list.priceListCode,
      productIds: list.products.flatMap((p) => idByCode.get(p.code) ?? []),
    })),
  });
}


export async function PUT(req: Request, { params }: Params): Promise<NextResponse> {
  const loaded = await load(req, params);
  if (!loaded.ok) return loaded.response;
  const { order, accountId } = loaded;

  const body = await req.json().catch(() => null);
  const result = await editCustomerOrder(order, body, { now: new Date(), mode: "customer" });
  if (!result.payFirst) return NextResponse.json(result.json, { status: result.status });

  try {
    const checkout = await startPaidChangeCheckout({ order, accountId, body, ...result.payFirst });
    return NextResponse.json({ ...result.json, checkoutUrl: checkout.url });
  } catch (err) {
    console.error("[customer order] Failed to start the payment for a change:", err);
    return reject("PAYMENT_START_FAILED", 502);
  }
}
