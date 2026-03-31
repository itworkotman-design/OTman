import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
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

  const { orderId } = await params;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId: session.activeCompanyId,
    },
    select: {
      id: true,
      productCardsSnapshot: true,
      orderNumber: true,
      description: true,
      modelNr: true,
      deliveryDate: true,
      timeWindow: true,
      pickupAddress: true,
      extraPickupAddress: true,
      deliveryAddress: true,
      drivingDistance: true,
      customerName: true,
      phone: true,
      phoneTwo: true,
      email: true,
      customerComments: true,
      floorNo: true,
      lift: true,
      cashierName: true,
      cashierPhone: true,
      subcontractorId: true,
      subcontractor: true,
      driver: true,
      secondDriver: true,
      driverInfo: true,
      licensePlate: true,
      deviation: true,
      feeExtraWork: true,
      feeAddToOrder: true,
      statusNotes: true,
      changeCustomerId: true,
      changeCustomer: true,
      status: true,
      dontSendEmail: true,
      priceExVat: true,
      priceSubcontractor: true,
      rabatt: true,
      leggTil: true,
      subcontractorMinus: true,
      subcontractorPlus: true,
    },
  });

  if (!order) {
    return NextResponse.json(
      { ok: false, reason: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    order: {
      id: order.id,
      productCards: Array.isArray(order.productCardsSnapshot)
        ? order.productCardsSnapshot
        : [],
      orderNumber: order.orderNumber ?? "",
      description: order.description ?? "",
      modelNr: order.modelNr ?? "",
      deliveryDate: order.deliveryDate ?? "",
      timeWindow: order.timeWindow ?? "",
      pickupAddress: order.pickupAddress ?? "",
      extraPickupAddress: order.extraPickupAddress ?? [],
      deliveryAddress: order.deliveryAddress ?? "",
      drivingDistance: order.drivingDistance ?? "",
      customerName: order.customerName ?? "",
      phone: order.phone ?? "",
      phoneTwo: order.phoneTwo ?? "",
      email: order.email ?? "",
      customerComments: order.customerComments ?? "",
      floorNo: order.floorNo ?? "",
      lift: order.lift ?? "",
      cashierName: order.cashierName ?? "",
      cashierPhone: order.cashierPhone ?? "",
      subcontractorId: order.subcontractorId ?? "",
      subcontractor: order.subcontractor ?? "",
      driver: order.driver ?? "",
      secondDriver: order.secondDriver ?? "",
      driverInfo: order.driverInfo ?? "",
      licensePlate: order.licensePlate ?? "",
      deviation: order.deviation ?? "",
      feeExtraWork: order.feeExtraWork,
      feeAddToOrder: order.feeAddToOrder,
      statusNotes: order.statusNotes ?? "",
      changeCustomerId: order.changeCustomerId ?? "",
      changeCustomer: order.changeCustomer ?? "",
      status: order.status ?? "",
      dontSendEmail: order.dontSendEmail,
      priceExVat: order.priceExVat,
      priceSubcontractor: order.priceSubcontractor,
      rabatt: order.rabatt ?? "",
      leggTil: order.leggTil ?? "",
      subcontractorMinus: order.subcontractorMinus ?? "",
      subcontractorPlus: order.subcontractorPlus ?? "",
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
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

  const { orderId } = await params;
  const body = await req.json().catch(() => null);

  if (!body || !Array.isArray(body.productCards)) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_PAYLOAD" },
      { status: 400 },
    );
  }

  await prisma.order.updateMany({
    where: {
      id: orderId,
      companyId: session.activeCompanyId,
    },
    data: {
      productCardsSnapshot: body.productCards,
      orderNumber: body.orderNumber ?? "",
      description: body.description ?? "",
      modelNr: body.modelNr ?? "",
      deliveryDate: body.deliveryDate ?? "",
      timeWindow: body.timeWindow ?? "",
      pickupAddress: body.pickupAddress ?? "",
      extraPickupAddress: Array.isArray(body.extraPickupAddress)
        ? body.extraPickupAddress
        : [],
      deliveryAddress: body.deliveryAddress ?? "",
      drivingDistance: body.drivingDistance ?? "",
      customerName: body.customerName ?? "",
      phone: body.phone ?? "",
      phoneTwo: body.phoneTwo ?? "",
      email: body.email ?? "",
      customerComments: body.customerComments ?? "",
      floorNo: body.floorNo ?? "",
      lift: body.lift ?? "",
      cashierName: body.cashierName ?? "",
      cashierPhone: body.cashierPhone ?? "",
      subcontractorId: body.subcontractorId ?? "",
      subcontractor: body.subcontractor ?? "",
      driver: body.driver ?? "",
      secondDriver: body.secondDriver ?? "",
      driverInfo: body.driverInfo ?? "",
      licensePlate: body.licensePlate ?? "",
      deviation: body.deviation ?? "",
      feeExtraWork: !!body.feeExtraWork,
      feeAddToOrder: !!body.feeAddToOrder,
      statusNotes: body.statusNotes ?? "",
      changeCustomerId: body.changeCustomerId ?? "",
      changeCustomer: body.changeCustomer ?? "",
      status: body.status ?? "",
      dontSendEmail: !!body.dontSendEmail,
      priceExVat: body.priceExVat ?? 0,
      priceSubcontractor: body.priceSubcontractor ?? 0,
      rabatt: body.rabatt ?? "",
      leggTil: body.leggTil ?? "",
      subcontractorMinus: body.subcontractorMinus ?? "",
      subcontractorPlus: body.subcontractorPlus ?? "",
    },
  });

  await prisma.orderItem.deleteMany({
    where: { orderId },
  });

  return NextResponse.json({ ok: true });
}