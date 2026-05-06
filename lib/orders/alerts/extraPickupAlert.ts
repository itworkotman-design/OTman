import { Prisma, type PrismaClient } from "@prisma/client";
import type { ExtraPickupInput } from "@/lib/orders/extraPickups";
import { createOrderNotification } from "@/lib/orders/orderNotifications";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

function formatExtraPickupContactLine(
  label: string,
  value: string | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed ? `${label}: ${trimmed}` : null;
}

export function buildExtraPickupAlert(extraPickups: ExtraPickupInput[]): {
  title: string;
  message: string;
  payload: {
    kind: "EXTRA_PICKUP";
    extraPickups: ExtraPickupInput[];
  };
} {
  const messageSections = extraPickups.map((pickup, index) => {
    const lines = [
      `Pickup ${index + 1}`,
      `Address: ${pickup.address}`,
      formatExtraPickupContactLine("Phone", pickup.phone),
      formatExtraPickupContactLine("Email", pickup.email),
    ].filter((line): line is string => typeof line === "string");

    return lines.join("\n");
  });

  return {
    title: "Extra pickup notification",
    message: [
      "Please contact store for extra pickup.",
      ...messageSections,
    ].join("\n\n"),
    payload: {
      kind: "EXTRA_PICKUP",
      extraPickups,
    },
  };
}

export async function createExtraPickupAlert(
  prisma: PrismaLike,
  input: {
    orderId: string;
    companyId: string;
    extraPickups: ExtraPickupInput[];
  },
) {
  if (input.extraPickups.length === 0) return null;

  const alert = buildExtraPickupAlert(input.extraPickups);

  return createOrderNotification(prisma, {
    orderId: input.orderId,
    companyId: input.companyId,
    type: "MANUAL_REVIEW",
    title: alert.title,
    message: alert.message,
    payload: alert.payload as unknown as Prisma.InputJsonValue,
  });
}
