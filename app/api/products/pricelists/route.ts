import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";

function buildNextPriceListName(index: number) {
  return `Pricelist ${index}`;
}

function buildNextPriceListCode(index: number) {
  return `PRICE_${index}`;
}

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const priceLists = await prisma.priceList.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return NextResponse.json(
    {
      ok: true,
      priceLists,
    },
    { status: 200 },
  );
}

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
    const body = await req.json().catch(() => null);

    const sourcePriceListId =
      typeof body?.sourcePriceListId === "string"
        ? body.sourcePriceListId
        : null;

    if (!sourcePriceListId) {
      return NextResponse.json(
        { ok: false, reason: "SOURCE_PRICELIST_REQUIRED" },
        { status: 400 },
      );
    }

    const sourcePriceList = await prisma.priceList.findUnique({
      where: {
        id: sourcePriceListId,
      },
      include: {
        specialOptions: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (!sourcePriceList) {
      return NextResponse.json(
        { ok: false, reason: "SOURCE_PRICELIST_NOT_FOUND" },
        { status: 404 },
      );
    }

    const existingCount = await prisma.priceList.count();

    let nextIndex = existingCount + 1;
    let nextName = buildNextPriceListName(nextIndex);
    let nextCode = buildNextPriceListCode(nextIndex);

    while (
      await prisma.priceList.findFirst({
        where: {
          OR: [{ name: nextName }, { code: nextCode }],
        },
        select: {
          id: true,
        },
      })
    ) {
      nextIndex += 1;
      nextName = buildNextPriceListName(nextIndex);
      nextCode = buildNextPriceListCode(nextIndex);
    }

    const newPriceList = await prisma.$transaction(async (tx) => {
      const created = await tx.priceList.create({
        data: {
          name: nextName,
          code: nextCode,
          description: sourcePriceList.description,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          code: true,
        },
      });

      if (sourcePriceList.specialOptions.length > 0) {
        await tx.priceListSpecialOption.createMany({
          data: sourcePriceList.specialOptions.map((option) => ({
            priceListId: created.id,
            type: option.type,
            code: option.code,
            label: option.label,
            description: option.description,
            customerPrice: option.customerPrice,
            subcontractorPrice: option.subcontractorPrice,
            discountAmount: option.discountAmount,
            discountEndsAt: option.discountEndsAt,
            isActive: option.isActive,
            sortOrder: option.sortOrder,
          })),
        });
      }

      return created;
    });

    return NextResponse.json(
      {
        ok: true,
        priceList: newPriceList,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create pricelist failed:", error);

    return NextResponse.json(
      { ok: false, reason: "CREATE_PRICELIST_FAILED" },
      { status: 500 },
    );
  }
}

