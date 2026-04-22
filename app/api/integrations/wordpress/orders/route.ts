// path: app/api/integrations/wordpress/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type WordpressOrderSyncPayload = {
  legacyWordpressOrderId: number;
  legacyWordpressUserId: number;
  createdAt?: string | null;
  status?: string | null;
  title?: string | null;
  meta?: Prisma.InputJsonValue | null;
};

type ParsedWordpressItem = {
  cardId: number;
  productName: string;
  quantity: number;
  deliveryType?: string;
  rawData: Prisma.InputJsonValue;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const buildItemsFromMeta = (
  meta: Record<string, unknown>,
): ParsedWordpressItem[] => {
  const items: ParsedWordpressItem[] = [];
  let index = 0;

  while (true) {
    const productName = asString(meta[`extra_products_${index}_velg_produkt`]);
    if (!productName) break;

    const deliveryType = asString(
      meta[`extra_products_${index}_velg_leveringstype`],
    );
    const qtyRaw = asString(meta[`extra_products_${index}_antall_produkter`]);
    const quantity = qtyRaw ? Number.parseFloat(qtyRaw) || 1 : 1;

    items.push({
      cardId: index + 1,
      productName,
      quantity,
      deliveryType,
      rawData: {
        productName,
        deliveryType: deliveryType ?? null,
        quantity,
        source: "wordpress_sync",
        metaIndex: index,
      },
    });

    index += 1;
  }

  return items;
};

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-wp-sync-secret");

    if (
      !process.env.WORDPRESS_SYNC_SECRET ||
      secret !== process.env.WORDPRESS_SYNC_SECRET
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as WordpressOrderSyncPayload;

    if (
      !body ||
      !Number.isInteger(body.legacyWordpressOrderId) ||
      !Number.isInteger(body.legacyWordpressUserId)
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const companyId = process.env.WORDPRESS_SYNC_COMPANY_ID;
    if (!companyId) {
      return NextResponse.json(
        { error: "Missing WORDPRESS_SYNC_COMPANY_ID" },
        { status: 500 },
      );
    }

    const membership = await prisma.membership.findFirst({
      where: {
        companyId,
        legacyWordpressUserId: body.legacyWordpressUserId,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        {
          error: "Membership not found for legacyWordpressUserId",
          legacyWordpressUserId: body.legacyWordpressUserId,
        },
        { status: 404 },
      );
    }

    const meta =
      body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? (body.meta as Record<string, unknown>)
        : {};

    const pickupAddress = asString(meta.pickup_address);
    const deliveryAddress = asString(meta.delivery_address);
    const returnAddress = asString(meta.returadresse);
    const description = asString(meta.beskrivelse) ?? asString(body.title);
    const customerName = asString(meta.kundens_navn);
    const phone = asString(meta.telefon);
    const deliveryDate = asString(meta.leveringsdato);
    const timeWindow = asString(meta.tidsvindu_for_levering);
    const orderNumber = asString(meta.bestillingsnr);
    const status = asString(meta.status) ?? asString(body.status);

    const items = buildItemsFromMeta(meta);
    const productsSummary =
      items.length > 0
        ? items
            .map((item) =>
              item.quantity > 1
                ? `${item.productName} x${item.quantity}`
                : item.productName,
            )
            .join(", ")
        : undefined;

    const deliveryTypeSummary =
      items
        .map((item) => item.deliveryType)
        .filter((value): value is string => Boolean(value))
        .join(", ") || undefined;

    const existing = await prisma.order.findUnique({
      where: {
        legacyWordpressOrderId: body.legacyWordpressOrderId,
      },
      select: {
        id: true,
        displayId: true,
      },
    });

    const order = existing
      ? await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const updated = await tx.order.update({
            where: {
              legacyWordpressOrderId: body.legacyWordpressOrderId,
            },
            data: {
              legacyWordpressAuthorId: body.legacyWordpressUserId,
              legacyWordpressRawMeta: body.meta ?? Prisma.JsonNull,
              status,
              description,
              pickupAddress,
              deliveryAddress,
              returnAddress,
              customerName,
              phone,
              deliveryDate,
              timeWindow,
              orderNumber,
              productsSummary,
              deliveryTypeSummary,
            },
            select: {
              id: true,
              displayId: true,
              legacyWordpressOrderId: true,
            },
          });

          await tx.orderItem.deleteMany({
            where: {
              orderId: updated.id,
              itemType: "wordpress_sync_raw",
            },
          });

          if (items.length > 0) {
            await tx.orderItem.createMany({
              data: items.map((item) => ({
                orderId: updated.id,
                cardId: item.cardId,
                itemType: "wordpress_sync_raw",
                productName: item.productName,
                deliveryType: item.deliveryType ?? null,
                quantity: item.quantity,
                rawData: item.rawData,
              })),
            });
          }

          return updated;
        })
      : await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const currentCounter = await tx.companyOrderCounter.upsert({
            where: { companyId },
            update: {},
            create: {
              companyId,
              nextNumber: 1,
            },
            select: {
              nextNumber: true,
            },
          });

          const created = await tx.order.create({
            data: {
              companyId,
              createdByMembershipId: membership.id,
              legacyWordpressOrderId: body.legacyWordpressOrderId,
              legacyWordpressAuthorId: body.legacyWordpressUserId,
              legacyWordpressRawMeta: body.meta ?? Prisma.JsonNull,
              createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
              updatedAt: body.createdAt ? new Date(body.createdAt) : undefined,
              displayId: currentCounter.nextNumber,
              status,
              description,
              pickupAddress,
              deliveryAddress,
              returnAddress,
              customerName,
              phone,
              deliveryDate,
              timeWindow,
              orderNumber,
              productsSummary,
              deliveryTypeSummary,
              dontSendEmail: true,
              extraPickupAddress: [],
            },
            select: {
              id: true,
              displayId: true,
              legacyWordpressOrderId: true,
            },
          });

          if (items.length > 0) {
            await tx.orderItem.createMany({
              data: items.map((item) => ({
                orderId: created.id,
                cardId: item.cardId,
                itemType: "wordpress_sync_raw",
                productName: item.productName,
                deliveryType: item.deliveryType ?? null,
                quantity: item.quantity,
                rawData: item.rawData,
              })),
            });
          }

          await tx.companyOrderCounter.update({
            where: { companyId },
            data: {
              nextNumber: { increment: 1 },
            },
          });

          return created;
        });

    return NextResponse.json({
      ok: true,
      order,
    });
  } catch (error) {
    console.error("wordpress order sync failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
