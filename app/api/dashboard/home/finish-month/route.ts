import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/sendEmail";
import { buildFinishMonthWorkbook } from "@/lib/dashboard/finishMonthWorkbook";

type MonthlySubcontractorOrder = {
  displayId: number;
  orderNumber: string | null;
  createdAt: Date;
  deliveryDate: string | null;
  customerLabel: string | null;
  customerName: string | null;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  returnAddress: string | null;
  priceSubcontractor: number | null;
  subcontractorMembershipId: string | null;
  subcontractor: string | null;
};

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

function getMonthLabel(date = new Date()): string {
  return date.toLocaleString("no-NO", {
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildFileName(input: {
  subcontractorName: string;
  monthDate: Date;
}): string {
  const month = String(input.monthDate.getMonth() + 1).padStart(2, "0");
  const year = input.monthDate.getFullYear();
  const safeName = input.subcontractorName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  return `finish-month-${safeName || "subcontractor"}-${year}-${month}.xlsx`;
}

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

  const membership = await getActiveMembership({
    userId: session.userId,
    companyId: session.activeCompanyId,
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  try {
    const currentDate = new Date();
    const { start, end } = getMonthRange(currentDate);
    const monthLabel = getMonthLabel(currentDate);

    const orders: MonthlySubcontractorOrder[] = await prisma.order.findMany({
      where: {
        companyId: session.activeCompanyId,
        createdAt: {
          gte: start,
          lt: end,
        },
        subcontractorMembershipId: {
          not: null,
        },
      },
      select: {
        displayId: true,
        orderNumber: true,
        createdAt: true,
        deliveryDate: true,
        customerLabel: true,
        customerName: true,
        pickupAddress: true,
        deliveryAddress: true,
        returnAddress: true,
        priceSubcontractor: true,
        subcontractorMembershipId: true,
        subcontractor: true,
      },
      orderBy: [{ subcontractor: "asc" }, { createdAt: "asc" }],
    });

    const subcontractorIds = Array.from(
      new Set(
        orders
          .map((order) => order.subcontractorMembershipId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (subcontractorIds.length === 0) {
      return NextResponse.json({
        ok: true,
        sentCount: 0,
        skippedCount: 0,
        message: `No subcontractor orders found for ${monthLabel}.`,
      });
    }

    const subcontractorMemberships = await prisma.membership.findMany({
      where: {
        id: {
          in: subcontractorIds,
        },
        companyId: session.activeCompanyId,
        status: "ACTIVE",
        user: {
          status: "ACTIVE",
        },
      },
      select: {
        id: true,
        user: {
          select: {
            email: true,
            username: true,
          },
        },
      },
    });

    const membershipMap = new Map(
      subcontractorMemberships.map((subcontractorMembership) => [
        subcontractorMembership.id,
        subcontractorMembership,
      ]),
    );
    const ordersBySubcontractor = new Map<string, MonthlySubcontractorOrder[]>();

    orders.forEach((order) => {
      const subcontractorMembershipId = order.subcontractorMembershipId;
      if (!subcontractorMembershipId || !membershipMap.has(subcontractorMembershipId)) {
        return;
      }

      const currentOrders =
        ordersBySubcontractor.get(subcontractorMembershipId) ?? [];
      currentOrders.push(order);
      ordersBySubcontractor.set(subcontractorMembershipId, currentOrders);
    });

    const sendJobs = Array.from(ordersBySubcontractor.entries()).map(
      async ([subcontractorMembershipId, subcontractorOrders]) => {
        const subcontractorMembership = membershipMap.get(
          subcontractorMembershipId,
        );

        if (!subcontractorMembership || subcontractorOrders.length === 0) {
          return null;
        }

        const subcontractorName =
          subcontractorMembership.user.username?.trim() ||
          subcontractorMembership.user.email;
        const fileName = buildFileName({
          subcontractorName,
          monthDate: currentDate,
        });
        const monthSum = subcontractorOrders.reduce(
          (sum, order) => sum + Number(order.priceSubcontractor ?? 0),
          0,
        );
        const workbook = await buildFinishMonthWorkbook({
          subcontractorName,
          monthLabel,
          orders: subcontractorOrders,
        });

        await sendEmail({
          to: {
            email: subcontractorMembership.user.email,
            name: subcontractorName,
          },
          subject: `Finish month summary - ${monthLabel}`,
          html: `
            <p>Hello ${subcontractorName},</p>
            <p>Attached is your order summary for ${monthLabel}.</p>
            <p>Month sum: ${formatCurrency(monthSum)}</p>
            <p>Orders included: ${subcontractorOrders.length}</p>
          `,
          text: [
            `Hello ${subcontractorName},`,
            "",
            `Attached is your order summary for ${monthLabel}.`,
            `Month sum: ${formatCurrency(monthSum)}`,
            `Orders included: ${subcontractorOrders.length}`,
          ].join("\n"),
          attachments: [
            {
              name: fileName,
              content: workbook.toString("base64"),
            },
          ],
        });

        return {
          subcontractorMembershipId,
          subcontractorName,
          orderCount: subcontractorOrders.length,
        };
      },
    );

    const results = await Promise.allSettled(sendJobs);
    const sent = results
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          subcontractorMembershipId: string;
          subcontractorName: string;
          orderCount: number;
        } | null> => result.status === "fulfilled",
      )
      .map((result) => result.value)
      .filter((value): value is NonNullable<typeof value> => value !== null);
    const failed = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    if (failed.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          reason: "PARTIAL_SEND_FAILED",
          sentCount: sent.length,
          failedCount: failed.length,
          message: `Sent ${sent.length} month summaries, ${failed.length} failed.`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      sentCount: sent.length,
      skippedCount: subcontractorIds.length - sent.length,
      message:
        sent.length > 0
          ? `Sent ${sent.length} month summaries for ${monthLabel}.`
          : `No subcontractor orders found for ${monthLabel}.`,
    });
  } catch (error) {
    console.error("Finish month error:", error);
    return NextResponse.json(
      { ok: false, reason: "FAILED_TO_FINISH_MONTH" },
      { status: 500 },
    );
  }
}
