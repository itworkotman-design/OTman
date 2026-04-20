export function buildCapacityWarningNotification(input: {
  deliveryDate: string;
  timeWindow: string;
  count: number;
  limit: number;
}) {
  return {
    title: "Capacity warning",
    message: [
      "Selected time window is full.",
      `Delivery date: ${input.deliveryDate}`,
      `Time window: ${input.timeWindow}`,
      `Orders in slot: ${input.count}`,
      `Limit: ${input.limit}`,
      "This order may need to be moved to another time window on the same day.",
    ].join("\n"),
    payload: {
      kind: "CAPACITY_WARNING" as const,
      deliveryDate: input.deliveryDate,
      timeWindow: input.timeWindow,
      count: input.count,
      limit: input.limit,
    },
  };
}
