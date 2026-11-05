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
  // The customer's note for the driver at each end.
  pickupComment?: string | null;
  deliveryComment?: string | null;
}): string {
  const withComment = (line: string, comment: string | null | undefined) =>
    comment?.trim() ? `${line}\n    *comment: ${comment.trim()}` : line;
  return [
    withComment(`Moving from: ${input.originLine}`, input.pickupComment),
    withComment(`Moving to: ${input.destinationLine}`, input.deliveryComment),
    input.serviceLabels.length > 0 ? `Additional services: ${input.serviceLabels.join(", ")}` : null,
    input.notes,
  ]
    .filter(Boolean)
    .join("\n\n");
}
