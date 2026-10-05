import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

// An order status in the customer's words (the dashboard's are staff terms).
const LABELS: Record<string, { no: string; en: string }> = {
  processing: { no: "Mottatt — behandles", en: "Received — being processed" },
  approved: { no: "Godkjent — venter på betaling", en: "Approved — awaiting payment" },
  rejected: { no: "Trenger endring", en: "Needs a change" },
  confirmed: { no: "Bekreftet", en: "Confirmed" },
  active: { no: "Pågår", en: "In progress" },
  cancelled: { no: "Kansellert", en: "Cancelled" },
  failed: { no: "Ikke gjennomført", en: "Not completed" },
  completed: { no: "Fullført", en: "Completed" },
  invoiced: { no: "Fullført", en: "Completed" },
  paid: { no: "Fullført", en: "Completed" },
};

export function customerStatusLabel(status: string | null | undefined, locale: "no" | "en"): string {
  const key = normalizeOrderStatus(status);
  return LABELS[key]?.[locale] ?? (status ?? "");
}
