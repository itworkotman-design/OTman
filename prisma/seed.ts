import "dotenv/config";
import { PrismaClient, PricingMode, RequestStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * Prisma 7 requires an explicit adapter.
 * We use the PostgreSQL adapter since this project uses pg.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("❌ DATABASE_URL is not set. Check your .env file.");
}

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data (respect FK order)
  await prisma.requestItem.deleteMany();
  await prisma.request.deleteMany();
  await prisma.service.deleteMany();
  await prisma.category.deleteMany();

  // Categories
  const transport = await prisma.category.create({
    data: {
      name: "Transport",
      sortOrder: 1,
      isActive: true,
    },
  });

  const logistics = await prisma.category.create({
    data: {
      name: "Logistics",
      sortOrder: 2,
      isActive: true,
    },
  });

  // Services
  const airportTransfer = await prisma.service.create({
    data: {
      title: "Airport Transfer",
      description: "Pickup and drop-off service to the airport",
      pricingMode: PricingMode.FIXED,
      priceCents: 5000,
      categoryId: transport.id,
      sortOrder: 1,
      isActive: true,
    },
  });

  const cargoDelivery = await prisma.service.create({
    data: {
      title: "Cargo Delivery",
      description: "On-demand cargo and goods delivery",
      pricingMode: PricingMode.REQUEST,
      categoryId: logistics.id,
      sortOrder: 1,
      isActive: true,
    },
  });

  // Requests
  const request1 = await prisma.request.create({
    data: {
      customerName: "John Doe",
      customerEmail: "john@example.com",
      customerPhone: "+31612345678",
      status: RequestStatus.NEW,
      message: "Need transport tomorrow morning",
    },
  });

  const request2 = await prisma.request.create({
    data: {
      customerName: "Sarah Smith",
      customerEmail: "sarah@example.com",
      status: RequestStatus.CONFIRMED,
      message: "Large cargo, please confirm availability",
    },
  });

  // Request items
  await prisma.requestItem.createMany({
    data: [
      {
        requestId: request1.id,
        serviceId: airportTransfer.id,
        titleSnapshot: airportTransfer.title,
        quantity: 1,
      },
      {
        requestId: request2.id,
        serviceId: cargoDelivery.id,
        titleSnapshot: cargoDelivery.title,
        quantity: 2,
        notes: "Fragile items",
      },
    ],
  });

  console.log("✅ Database seeded successfully");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
