import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canCreateOrders } from "@/lib/users/orderAccess";
import {
  optionalBoolean,
  optionalString,
  safeNumber,
} from "@/lib/orders/normalizeOrderInput";
import { buildOrderSummaries } from "@/lib/orders/buildOrderSummaries";
import { getBookingCatalog } from "@/lib/booking/catalog/getBookingCatalog";
import { buildOrderItemsFromCards } from "@/lib/orders/buildOrderItemsFromCards";
import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { AppPermission } from "@/lib/users/types";

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (!session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      role: true,
      priceListId: true,
      permissions: {
        select: {
          permission: true,
        },
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const permissions = membership.permissions.map(
    (p): AppPermission => p.permission,
  );

  if (!canCreateOrders(membership.role, permissions)) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);

  if (
    !body ||
    !Array.isArray(body.productCards) ||
    body.productCards.length === 0
  ) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_PRODUCT_CARDS" },
      { status: 400 },
    );
  }

  const productCards = body.productCards as SavedProductCard[];

  const catalog = await getBookingCatalog(membership.priceListId ?? null);

  const summaries = buildOrderSummaries(
    productCards,
    catalog.products,
    catalog.specialOptions,
  );

  const order = await prisma.order.create({
    data: {
      companyId: session.activeCompanyId,
      createdByMembershipId: membership.id,

      orderNumber: optionalString(body.orderNumber),
      description: optionalString(body.description),
      modelNr: optionalString(body.modelNr),

      deliveryDate: optionalString(body.deliveryDate),
      timeWindow: optionalString(body.timeWindow),

      pickupAddress: optionalString(body.pickupAddress),
      extraPickupAddress: Array.isArray(body.extraPickupAddress)
        ? body.extraPickupAddress
            .filter(
              (value: unknown): value is string => typeof value === "string",
            )
            .map((value: string) => value.trim())
            .filter(Boolean)
        : [],
      deliveryAddress: optionalString(body.deliveryAddress),
      drivingDistance: optionalString(body.drivingDistance),

      customerName: optionalString(body.customerName),
      phone: optionalString(body.phone),
      phoneTwo: optionalString(body.phoneTwo),
      email: optionalString(body.email),
      customerComments: optionalString(body.customerComments),

      floorNo: optionalString(body.floorNo),
      lift: optionalString(body.lift),

      cashierName: optionalString(body.cashierName),
      cashierPhone: optionalString(body.cashierPhone),

      subcontractorId: optionalString(body.subcontractorId),
      subcontractor: optionalString(body.subcontractor),

      driver: optionalString(body.driver),
      secondDriver: optionalString(body.secondDriver),
      driverInfo: optionalString(body.driverInfo),
      licensePlate: optionalString(body.licensePlate),

      deviation: optionalString(body.deviation),
      feeExtraWork: optionalBoolean(body.feeExtraWork),
      feeAddToOrder: optionalBoolean(body.feeAddToOrder),
      statusNotes: optionalString(body.statusNotes),
      changeCustomerId: optionalString(body.changeCustomerId),
      changeCustomer: optionalString(body.changeCustomer),
      status: optionalString(body.status),
      dontSendEmail: optionalBoolean(body.dontSendEmail),

      priceExVat: Math.round(safeNumber(body.priceExVat)),
      priceSubcontractor: Math.round(safeNumber(body.priceSubcontractor)),

      rabatt: optionalString(body.rabatt),
      leggTil: optionalString(body.leggTil),
      subcontractorMinus: optionalString(body.subcontractorMinus),
      subcontractorPlus: optionalString(body.subcontractorPlus),

      productsSummary: summaries.productsSummary,
      deliveryTypeSummary: summaries.deliveryTypeSummary,
      servicesSummary: summaries.servicesSummary,

      productCardsSnapshot: productCards as unknown as Prisma.InputJsonValue,
    },
  });

  const builtItems = buildOrderItemsFromCards(
    productCards,
    catalog.products,
    catalog.specialOptions,
  );

  for (const item of builtItems) {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        cardId: item.cardId,
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        deliveryType: item.deliveryType,
        itemType: item.itemType,
        optionId: item.optionId,
        optionCode: item.optionCode,
        optionLabel: item.optionLabel,
        quantity: item.quantity,
        customerPriceCents: item.customerPriceCents,
        subcontractorPriceCents: item.subcontractorPriceCents,
        rawData: item.rawData
          ? (item.rawData as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }
 

  return NextResponse.json({
    ok: true,
    orderId: order.id,
  });
}

 export async function GET(req: Request) {
   const session = await getAuthenticatedSession(req);

   if (!session) {
     return NextResponse.json(
       { ok: false, reason: "UNAUTHORIZED" },
       { status: 401 },
     );
   }

   if (!session.activeCompanyId) {
     return NextResponse.json(
       { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
       { status: 409 },
     );
   }

   const membership = await prisma.membership.findFirst({
     where: {
       userId: session.userId,
       companyId: session.activeCompanyId,
       status: "ACTIVE",
     },
     select: {
       role: true,
       permissions: {
         select: {
           permission: true,
         },
       },
     },
   });

   if (!membership) {
     return NextResponse.json(
       { ok: false, reason: "FORBIDDEN" },
       { status: 403 },
     );
   }

   const orders = await prisma.order.findMany({
     where: {
       companyId: session.activeCompanyId,
     },
     orderBy: {
       createdAt: "desc",
     },
     select: {
       id: true,
       status: true,
       statusNotes: true,
       deliveryDate: true,
       timeWindow: true,
       customerName: true,
       orderNumber: true,
       phone: true,
       pickupAddress: true,
       extraPickupAddress: true,
       deliveryAddress: true,
       productsSummary: true,
       deliveryTypeSummary: true,
       servicesSummary: true,
       description: true,
       cashierName: true,
       cashierPhone: true,
       customerComments: true,
       driverInfo: true,
       subcontractor: true,
       driver: true,
       createdAt: true,
       updatedAt: true,
       priceExVat: true,
       priceSubcontractor: true,
       createdByMembership: {
         select: {
           user: {
             select: {
               username: true,
               email: true,
             },
           },
         },
       },
     },
   });

   return NextResponse.json({
     ok: true,
     orders: orders.map((order) => ({
       id: order.id,
       status: order.status ?? "",
       statusNotes: order.statusNotes ?? "",
       deliveryDate: order.deliveryDate ?? "",
       timeWindow: order.timeWindow ?? "",
       customerName: order.customerName ?? "",
       orderNumber: order.orderNumber ?? "",
       phone: order.phone ?? "",
       pickupAddress: order.pickupAddress ?? "",
       extraPickupAddress: order.extraPickupAddress ?? [],
       deliveryAddress: order.deliveryAddress ?? "",
       productsSummary: order.productsSummary ?? "",
       deliveryTypeSummary: order.deliveryTypeSummary ?? "",
       servicesSummary: order.servicesSummary ?? "",
       description: order.description ?? "",
       cashierName: order.cashierName ?? "",
       cashierPhone: order.cashierPhone ?? "",
       customerComments: order.customerComments ?? "",
       driverInfo: order.driverInfo ?? "",
       subcontractor: order.subcontractor ?? "",
       driver: order.driver ?? "",
       createdAt: order.createdAt,
       updatedAt: order.updatedAt,
       priceExVat: order.priceExVat,
       priceSubcontractor: order.priceSubcontractor,
       createdBy:
         order.createdByMembership.user.username ||
         order.createdByMembership.user.email ||
         "",
     })),
   });
 }
