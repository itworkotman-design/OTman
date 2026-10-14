// Moving requests (app/api/site/moving-request/route.ts) have no dedicated
// columns for where they're moving from/to or the additional services —
// staff read them from Order.description, so they go there as plain lines
// above the customer's own notes. Each end's line comes from
// movingPropertyLine (lib/orders/movingProperty.ts).
export function movingOrderDescription(input: {
  originLine: string;
  destinationLine: string;
  serviceLabels: string[];
  notes: string | null;
}): string {
  return [
    `Moving from: ${input.originLine}`,
    `Moving to: ${input.destinationLine}`,
    input.serviceLabels.length > 0 ? `Additional services: ${input.serviceLabels.join(", ")}` : null,
    input.notes,
  ]
    .filter(Boolean)
    .join("\n\n");
}
