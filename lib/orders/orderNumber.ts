import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const MANUAL_ORDER_NUMBER_START = 20000;

type OrderNumberTransactionClient = Pick<Prisma.TransactionClient, "companyOrderCounter" | "order">;

async function findNextUnusedOrderNumber(params: {
  tx: OrderNumberTransactionClient;
  companyId: string;
  startAt: number;
}): Promise<number> {
  let candidate = params.startAt;

  while (true) {
    const existing = await params.tx.order.findFirst({
      where: {
        companyId: params.companyId,
        OR: [{ displayId: candidate }, { orderNumber: String(candidate) }],
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return candidate;
    }

    candidate += 1;
  }
}

export async function reserveNextManualOrderNumber(companyId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.companyOrderCounter.findUnique({
      where: { companyId },
    });

    const startAt = existing?.nextNumber ?? MANUAL_ORDER_NUMBER_START;
    const reserved = await findNextUnusedOrderNumber({
      tx,
      companyId,
      startAt,
    });

    if (!existing) {
      await tx.companyOrderCounter.create({
        data: {
          companyId,
          nextNumber: reserved + 1,
        },
      });
    } else {
      await tx.companyOrderCounter.update({
        where: { companyId },
        data: {
          nextNumber: reserved + 1,
        },
      });
    }

    return reserved;
  });
}
