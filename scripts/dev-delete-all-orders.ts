// Deletes EVERY order (all companies) in the database .env.local points at,
// plus "My order" customer logins left without orders. Refuses anything that
// isn't a Neon host (production is on Render). Dry run unless --apply.
// Run from the project folder: npx tsx scripts/dev-delete-all-orders.ts [--apply]
import { config } from "dotenv";
config({ path: ".env.local", override: true, quiet: true });

async function main() {
  const apply = process.argv.includes("--apply");
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  console.log("Database host:", host);
  if (!host.endsWith(".neon.tech")) throw new Error("Not a Neon host — refusing.");

  const { prisma } = await import("@/lib/db");
  const counts = {
    orders: await prisma.order.count(),
    payments: await prisma.orderPayment.count(),
    refunds: await prisma.orderRefund.count(),
    customerAccounts: await prisma.customerAccount.count(),
  };
  console.log("Now:", counts);

  if (!apply) {
    console.log("Dry run — nothing deleted. Add --apply to delete.");
    await prisma.$disconnect();
    return;
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const orders = await tx.order.deleteMany({});
    const orphanAccounts = { orders: { none: {} } };
    const sessions = await tx.customerSession.deleteMany({ where: { customerAccount: orphanAccounts } });
    const accounts = await tx.customerAccount.deleteMany({ where: orphanAccounts });
    return { orders: orders.count, customerSessions: sessions.count, customerAccounts: accounts.count };
  }, { timeout: 120_000 });
  console.log("Deleted:", deleted);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
