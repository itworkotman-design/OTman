import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";

type SourceSpecialOption = {
  type: "RETURN" | "XTRA" | "EXTRA_SERVICE";
  code: string;
  label: string | null;
  description: string | null;
  customerPrice: Prisma.Decimal | number | string;
  subcontractorPrice: Prisma.Decimal | number | string;
  discountAmount: string | null;
  discountEndsAt: Date | null;
  isActive: boolean;
  sortOrder: number;
};

type AutomaticXtraKind = "INDOOR" | "FIRST_STEP";

function buildNextPriceListName(index: number) {
  return `Pricelist ${index}`;
}

function buildNextPriceListCode(index: number) {
  return `PRICE_${index}`;
}

function normalizeAutomaticXtraText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function inferAutomaticXtraKind(option: {
  code: string;
  label: string | null;
  description: string | null;
}): AutomaticXtraKind {
  const signal = [
    normalizeAutomaticXtraText(option.code),
    normalizeAutomaticXtraText(option.label),
    normalizeAutomaticXtraText(option.description),
  ].join(" ");

  if (
    signal.includes("first_step") ||
    signal.includes("first step") ||
    signal.includes("levering") ||
    signal.includes("delivery")
  ) {
    return "FIRST_STEP";
  }

  return "INDOOR";
}

function buildAutomaticXtraOption(
  kind: AutomaticXtraKind,
  sortOrder: number,
) {
  if (kind === "FIRST_STEP") {
    return {
      type: "XTRA" as const,
      code: "XTRAFIRST",
      label: "XTRA",
      description: "Ekstra levering",
      customerPrice: 0,
      subcontractorPrice: 0,
      discountAmount: null,
      discountEndsAt: null,
      isActive: true,
      sortOrder,
    };
  }

  return {
    type: "XTRA" as const,
    code: "XTRA",
    label: "XTRA",
    description: "Ekstra innbæring",
    customerPrice: 0,
    subcontractorPrice: 0,
    discountAmount: null,
    discountEndsAt: null,
    isActive: true,
    sortOrder,
  };
}

function buildSpecialOptionsForNewPriceList(
  sourceSpecialOptions: SourceSpecialOption[],
) {
  const copiedSpecialOptions = sourceSpecialOptions.map((option) => ({
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
  }));

  const automaticXtraKinds = new Set<AutomaticXtraKind>(
    copiedSpecialOptions
      .filter((option) => option.type === "XTRA")
      .map((option) => inferAutomaticXtraKind(option)),
  );

  const highestSortOrder = copiedSpecialOptions.reduce(
    (max, option) => Math.max(max, option.sortOrder),
    0,
  );

  let nextSortOrder = highestSortOrder + 1;

  for (const kind of ["INDOOR", "FIRST_STEP"] as const) {
    if (automaticXtraKinds.has(kind)) {
      continue;
    }

    copiedSpecialOptions.push(buildAutomaticXtraOption(kind, nextSortOrder));
    nextSortOrder += 1;
  }

  return copiedSpecialOptions;
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

      const specialOptions = buildSpecialOptionsForNewPriceList(
        sourcePriceList.specialOptions,
      );

      if (specialOptions.length > 0) {
        await tx.priceListSpecialOption.createMany({
          data: specialOptions.map((option) => ({
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

