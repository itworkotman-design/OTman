import { prisma } from "./lib/db";

async function main() {
  const order = await prisma.order.findFirst({
    where: { legacyWordpressOrderId: 17775 },
    include: { items: true },
  });

  console.log(JSON.stringify(order, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
