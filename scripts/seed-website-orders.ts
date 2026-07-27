import "./_loadDevEnv";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { reserveNextManualOrderNumber } from "../lib/orders/orderNumber";
import { buildOrderPricingSnapshot } from "../lib/orders/orderTotals";
import { createOrderActionToken } from "../lib/orders/orderActionToken";

// Dev-only helper: seeds a handful of realistic website orders across every
// stage of the approve → pay → confirm lifecycle (plus rejected/cancelled), so
// the new Website Orders page has something to click around in locally.
// Not wired into any app code path — run manually with `tsx scripts/seed-website-orders.ts`.

type SeedOrderInput = {
  status: string;
  customerName: string;
  email: string;
  phone: string;
  pickupAddress: string;
  deliveryAddress: string;
  deliveryDate: string;
  timeWindow: string;
  description: string;
  productsSummary: string;
  priceExVat: number;
  statusNotes?: string;
  approvedDaysAgo?: number;
  rejectedDaysAgo?: number;
  paymentRequestSentDaysAgo?: number;
  paymentReminderSentDaysAgo?: number;
  withActionToken?: boolean;
  stripeAmountChargedCents?: number;
};

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function futureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

const SEED_ORDERS: SeedOrderInput[] = [
  // Processing — fresh, awaiting the admin's first decision
  {
    status: "processing",
    customerName: "Kari Nordmann",
    email: "kari.nordmann@example.com",
    phone: "91234567",
    pickupAddress: "Storgata 12, 0155 Oslo",
    deliveryAddress: "Bygdøy Allé 5, 0257 Oslo",
    deliveryDate: futureDate(5),
    timeWindow: "08:00-12:00",
    description: "Flytting av 2-roms leilighet",
    productsSummary: "Flyttepakke - 2 roms",
    priceExVat: 8500,
  },
  {
    status: "processing",
    customerName: "Ola Hansen",
    email: "ola.hansen@example.com",
    phone: "92345678",
    pickupAddress: "Karl Johans gate 22, 0159 Oslo",
    deliveryAddress: "Sognsveien 70, 0855 Oslo",
    deliveryDate: futureDate(6),
    timeWindow: "12:00-16:00",
    description: "Henting av sofa og spisebord",
    productsSummary: "Møbeltransport",
    priceExVat: 2400,
  },
  {
    status: "processing",
    customerName: "Mette Solberg",
    email: "mette.solberg@example.com",
    phone: "93456789",
    pickupAddress: "Grünerløkka 8, 0552 Oslo",
    deliveryAddress: "Frogner Plass 1, 0263 Oslo",
    deliveryDate: futureDate(7),
    timeWindow: "16:00-20:00",
    description: "Flytting av 3-roms leilighet med piano",
    productsSummary: "Flyttepakke - 3 roms, piano",
    priceExVat: 14200,
  },
  {
    status: "processing",
    customerName: "Jonas Berg",
    email: "jonas.berg@example.com",
    phone: "94567890",
    pickupAddress: "Majorstuen 3, 0367 Oslo",
    deliveryAddress: "Nydalen 14, 0484 Oslo",
    deliveryDate: futureDate(4),
    timeWindow: "08:00-12:00",
    description: "Levering av hvitevarer",
    productsSummary: "Pakkelevering",
    priceExVat: 1800,
  },

  // Approved — pre-generated action token, ready to test "send payment email" and the /betaling page
  {
    status: "approved",
    customerName: "Anne Lie",
    email: "anne.lie@example.com",
    phone: "95678901",
    pickupAddress: "Torshov 9, 0472 Oslo",
    deliveryAddress: "Ullevål 22, 0850 Oslo",
    deliveryDate: futureDate(8),
    timeWindow: "08:00-12:00",
    description: "Flytting av kontor",
    productsSummary: "Kontorflytting",
    priceExVat: 11000,
    approvedDaysAgo: 1,
    withActionToken: true,
  },
  {
    status: "approved",
    customerName: "Per Kristiansen",
    email: "per.kristiansen@example.com",
    phone: "96789012",
    pickupAddress: "Bislett 4, 0170 Oslo",
    deliveryAddress: "Skøyen 11, 0276 Oslo",
    deliveryDate: futureDate(9),
    timeWindow: "12:00-16:00",
    description: "Flytting av 1-roms leilighet",
    productsSummary: "Flyttepakke - 1 roms",
    priceExVat: 5600,
    approvedDaysAgo: 0,
    withActionToken: true,
  },
  {
    status: "approved",
    customerName: "Silje Dahl",
    email: "silje.dahl@example.com",
    phone: "97890123",
    pickupAddress: "Vika 2, 0161 Oslo",
    deliveryAddress: "Nordstrand 33, 1170 Oslo",
    deliveryDate: futureDate(10),
    timeWindow: "16:00-20:00",
    description: "Flytting av 4-roms enebolig",
    productsSummary: "Flyttepakke - enebolig",
    priceExVat: 21500,
    approvedDaysAgo: 2,
    withActionToken: true,
  },

  // Rejected — has the admin's comment + a token, ready to test "send rejection email" and cancel/request-change
  {
    status: "rejected",
    customerName: "Thomas Fjeld",
    email: "thomas.fjeld@example.com",
    phone: "98901234",
    pickupAddress: "Ekeberg 6, 1181 Oslo",
    deliveryAddress: "Holmenkollen 19, 0787 Oslo",
    deliveryDate: futureDate(3),
    timeWindow: "08:00-12:00",
    description: "Flytting med kort varsel",
    productsSummary: "Flyttepakke - 2 roms",
    priceExVat: 9200,
    statusNotes: "Ønsket leveringsdato er for tett opptil bestillingstidspunktet — trenger minst 5 virkedager.",
    rejectedDaysAgo: 1,
    withActionToken: true,
  },
  {
    status: "rejected",
    customerName: "Ingrid Moen",
    email: "ingrid.moen@example.com",
    phone: "99012345",
    pickupAddress: "Frogner 15, 0266 Oslo",
    deliveryAddress: "Ullern 8, 0381 Oslo",
    deliveryDate: futureDate(6),
    timeWindow: "12:00-16:00",
    description: "Flytting av klaver og tunge møbler",
    productsSummary: "Spesialtransport - klaver",
    priceExVat: 6800,
    statusNotes: "Adressen mangler heis og trapperommet er for smalt for pianotransport uten ekstra spesialutstyr.",
    rejectedDaysAgo: 2,
    withActionToken: true,
  },

  // Approved, reminder overdue — paymentRequestSentAt is >24h ago with no
  // reminder sent yet, so the next sweep run should send the reminder email.
  {
    status: "approved",
    customerName: "Erik Vik",
    email: "erik.vik@example.com",
    phone: "90123456",
    pickupAddress: "Sagene 11, 0459 Oslo",
    deliveryAddress: "Kampen 4, 0654 Oslo",
    deliveryDate: futureDate(2),
    timeWindow: "08:00-12:00",
    description: "Flytting av 2-roms leilighet",
    productsSummary: "Flyttepakke - 2 roms",
    priceExVat: 8900,
    approvedDaysAgo: 2,
    paymentRequestSentDaysAgo: 2,
    withActionToken: true,
  },

  // Cancelled — paymentReminderSentAt backdated past the 3-day window, as if
  // the cron already cancelled it for non-payment.
  {
    status: "cancelled",
    customerName: "Camilla Strand",
    email: "camilla.strand@example.com",
    phone: "91234098",
    pickupAddress: "St. Hanshaugen 7, 0175 Oslo",
    deliveryAddress: "Tøyen 3, 0578 Oslo",
    deliveryDate: futureDate(1),
    timeWindow: "16:00-20:00",
    description: "Flytting av 3-roms leilighet",
    productsSummary: "Flyttepakke - 3 roms",
    priceExVat: 12300,
    approvedDaysAgo: 5,
    paymentRequestSentDaysAgo: 5,
    paymentReminderSentDaysAgo: 4,
    withActionToken: true,
  },

  // Confirmed — as if the customer already paid via Stripe
  {
    status: "confirmed",
    customerName: "Henrik Aas",
    email: "henrik.aas@example.com",
    phone: "92345109",
    pickupAddress: "Grønland 9, 0188 Oslo",
    deliveryAddress: "Manglerud 21, 0678 Oslo",
    deliveryDate: futureDate(11),
    timeWindow: "12:00-16:00",
    description: "Flytting av 2-roms leilighet",
    productsSummary: "Flyttepakke - 2 roms",
    priceExVat: 9700,
    approvedDaysAgo: 1,
    withActionToken: true,
    stripeAmountChargedCents: Math.round(9700 * 1.25 * 100),
  },
];

async function main() {
  const membershipId = process.env.WEBSITE_MEMBERSHIP_ID;
  if (!membershipId) {
    throw new Error("WEBSITE_MEMBERSHIP_ID not configured in .env");
  }

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, companyId: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Website membership not found or inactive — check WEBSITE_MEMBERSHIP_ID");
  }

  let created = 0;

  for (const input of SEED_ORDERS) {
    const displayId = await reserveNextManualOrderNumber(membership.companyId);

    const pricingSnapshot = buildOrderPricingSnapshot({
      lines: [],
      rabatt: null,
      leggTil: null,
      subcontractorMinus: null,
      subcontractorPlus: null,
      fallbackCustomerTotalExVat: input.priceExVat,
      fallbackSubcontractorTotal: 0,
    });

    const order = await prisma.order.create({
      data: {
        companyId: membership.companyId,
        createdByMembershipId: membership.id,
        customerMembershipId: membership.id,
        displayId,
        status: input.status,
        isWebsiteOrder: true,
        customerName: input.customerName,
        email: input.email,
        phone: input.phone,
        pickupAddress: input.pickupAddress,
        deliveryAddress: input.deliveryAddress,
        deliveryDate: input.deliveryDate,
        timeWindow: input.timeWindow,
        description: input.description,
        productsSummary: input.productsSummary,
        priceExVat: input.priceExVat,
        priceSubcontractor: 0,
        pricingSnapshot: pricingSnapshot as unknown as Prisma.InputJsonValue,
        statusNotes: input.statusNotes ?? null,
        approvedAt: input.approvedDaysAgo !== undefined ? daysAgo(input.approvedDaysAgo) : null,
        rejectedAt: input.rejectedDaysAgo !== undefined ? daysAgo(input.rejectedDaysAgo) : null,
        paymentRequestSentAt: input.paymentRequestSentDaysAgo !== undefined ? daysAgo(input.paymentRequestSentDaysAgo) : null,
        paymentReminderSentAt: input.paymentReminderSentDaysAgo !== undefined ? daysAgo(input.paymentReminderSentDaysAgo) : null,
        actionToken: input.withActionToken ? createOrderActionToken() : null,
        stripeAmountChargedCents: input.stripeAmountChargedCents ?? null,
      },
      select: { displayId: true, status: true, customerName: true },
    });

    created += 1;
    console.log(`Seeded order #${order.displayId} — ${order.status} — ${order.customerName}`);
  }

  console.log(`\nDone. Seeded ${created} website orders.`);
}

main()
  .catch((error) => {
    console.error("Seeding website orders failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
