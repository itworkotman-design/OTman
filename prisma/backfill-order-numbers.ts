import { prisma } from "../lib/db";

async function main() {
  const orders = await prisma.order.findMany({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      companyId: true,
      orderNumber: true,
    },
  });

  const counters = new Map<string, number>();

  for (const order of orders) {
    const next = counters.get(order.companyId) ?? 20000;

    if (order.orderNumber == null) {
      await prisma.order.update({
        where: { id: order.id },
        data: { orderNumber: String(next) },
      });
    }

    counters.set(order.companyId, next + 1);
  }

  console.log("Backfill complete");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
