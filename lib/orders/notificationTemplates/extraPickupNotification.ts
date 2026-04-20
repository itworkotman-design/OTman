import type { ExtraPickupInput } from "@/lib/orders/extraPickups";

function formatExtraPickupContactLine(
  label: string,
  value: string | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed ? `${label}: ${trimmed}` : null;
}

export function buildExtraPickupNotification(
  extraPickups: ExtraPickupInput[],
): {
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
