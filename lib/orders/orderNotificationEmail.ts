import { sendEmail } from "@/lib/email/sendEmail";
import type { BuiltOrderItem } from "@/lib/orders/buildOrderItemsFromCards";

export const ORDER_NOTIFICATION_EMAIL =
  process.env.ORDER_NOTIFICATION_EMAIL?.trim() || "itworkotman@gmail.com";

type NotificationOrder = {
  id: string;
  displayId?: number | null;
  orderNumber?: string | null;
  customerLabel?: string | null;
  deliveryDate?: string | null;
  pickupAddress?: string | null;
  extraPickupAddress?: string[] | null;
  deliveryAddress?: string | null;
  drivingDistance?: string | null;
  timeWindow?: string | null;
  description?: string | null;
  customerName?: string | null;
  email?: string | null;
  phone?: string | null;
  floorNo?: string | null;
  lift?: string | boolean | null;
  cashierName?: string | null;
  cashierPhone?: string | null;
  status?: string | null;
  createdAt?: Date | string | null;
  productsSummary?: string | null;
  priceExVat?: number | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateNorwegian(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatStatus(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function formatMoneyNok(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";

  return `${new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} NOK`;
}

function formatLift(value?: string | boolean | null) {
  if (typeof value === "boolean") return value ? "JA" : "NEI";
  if (!value) return "";
  const normalized = value.trim().toLowerCase();
  if (normalized === "ja" || normalized === "yes" || normalized === "true") {
    return "JA";
  }
  if (normalized === "nei" || normalized === "no" || normalized === "false") {
    return "NEI";
  }
  return value;
}

function detailLine(label: string, value?: string | null) {
  if (!value) return "";
  return `<p style="margin:0 0 12px 0;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

function groupItemsByCard(items: BuiltOrderItem[]) {
  const map = new Map<number, BuiltOrderItem[]>();

  for (const item of items) {
    const existing = map.get(item.cardId) ?? [];
    existing.push(item);
    map.set(item.cardId, existing);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, cardItems]) => cardItems);
}

function getItemDescription(item: BuiltOrderItem) {
  const rawData =
    item.rawData &&
    typeof item.rawData === "object" &&
    !Array.isArray(item.rawData)
      ? (item.rawData as {
          description?: string | null;
          label?: string | null;
          code?: string | null;
        })
      : null;

  return (
    rawData?.description?.trim() ||
    rawData?.label?.trim() ||
    item.optionLabel?.trim() ||
    rawData?.code?.trim() ||
    item.optionCode?.trim() ||
    "Valgt tillegg"
  );
}

function renderOrderItems(order: NotificationOrder, items: BuiltOrderItem[]) {
  const grouped = groupItemsByCard(items);

  if (grouped.length === 0) {
    return order.productsSummary
      ? `<p style="margin:20px 0 0 0;">${escapeHtml(order.productsSummary)}</p>`
      : "";
  }

  return grouped
    .map((group) => {
      const productCard =
        group.find((item) => item.itemType === "PRODUCT_CARD") ?? group[0];

      const productHeading = productCard?.productName?.trim() || "Produkt";
      const productCardRawData =
        productCard?.rawData &&
        typeof productCard.rawData === "object" &&
        !Array.isArray(productCard.rawData)
          ? (productCard.rawData as {
              hoursInput?: number;
            })
          : null;
      const laborSuffix =
        productCardRawData &&
        typeof productCardRawData.hoursInput === "number"
          ? ` (${productCardRawData.hoursInput} t)`
          : "";
      const quantitySuffix =
        productCard?.quantity && productCard.quantity > 1
          ? ` x${productCard.quantity}`
          : "";

      const optionLines = group
        .filter((item) => item.itemType !== "PRODUCT_CARD")
        .map((item) => {
          const label = getItemDescription(item);
          const codeSuffix = item.optionCode?.trim()
            ? ` (${item.optionCode.trim()})`
            : "";
          const quantity = item.quantity > 1 ? ` x${item.quantity}` : "";
          const linePrice =
            typeof item.customerPriceCents === "number"
              ? formatMoneyNok((item.customerPriceCents * item.quantity) / 100)
              : "";

          return `<li style="margin:0 0 6px 18px;">${escapeHtml(
            `${label}${codeSuffix}${quantity}${linePrice ? ` ${linePrice}` : ""}`,
          )}</li>`;
        })
        .join("");

      return `
        <div style="margin:18px 0 0 0;">
          <p style="margin:0 0 8px 0;font-weight:700;">${escapeHtml(`${productHeading}${quantitySuffix}${laborSuffix}`)}</p>
          ${optionLines ? `<ul style="margin:0;padding:0;">${optionLines}</ul>` : ""}
        </div>
      `;
    })
    .join("");
}

export async function sendOrderNotificationEmail({
  kind,
  order,
  items,
}: {
  kind: "created" | "updated";
  order: NotificationOrder;
  items: BuiltOrderItem[];
}) {
  const reference =
    order.orderNumber?.trim() ||
    (typeof order.displayId === "number" ? String(order.displayId) : order.id);

  const customer = order.customerLabel?.trim() || "Ukjent bestiller";
  const titlePrefix = kind === "created" ? "🆕 Ny ordre" : "✏️ Endret ordre";
  const subject = `${titlePrefix} #${reference} fra ${customer}`;

  const priceExVat = typeof order.priceExVat === "number" ? order.priceExVat : 0;
  const vat = priceExVat * 0.25;
  const totalIncVat = priceExVat + vat;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;max-width:900px;margin:0 auto;">
      <h2 style="margin:0 0 20px 0;color:#273097;">Oversikt over bestillingen:</h2>

      ${detailLine("Bestiller", order.customerLabel ?? "")}
      ${detailLine("Leveringsdato", formatDateNorwegian(order.deliveryDate))}
      ${detailLine("Henteadresse", order.pickupAddress ?? "")}
      ${
        Array.isArray(order.extraPickupAddress) && order.extraPickupAddress.length > 0
          ? detailLine("Ekstra hentesteder", order.extraPickupAddress.join(", "))
          : ""
      }
      ${detailLine("Leveringsadresse", order.deliveryAddress ?? "")}
      ${detailLine("Total kjøreavstand", order.drivingDistance ?? "")}
      ${detailLine("Tidsvindu for levering", order.timeWindow ?? "")}
      ${detailLine("Power Bilagsnummer", reference)}
      ${detailLine("Beskrivelse", order.description ?? "")}
      ${detailLine("Kundens Navn", order.customerName ?? "")}
      ${detailLine("E-postadresse", order.email ?? "")}
      ${detailLine("Telefon", order.phone ?? "")}
      ${detailLine("Etasje nr", order.floorNo ?? "")}
      ${detailLine("Heis", formatLift(order.lift))}
      ${detailLine("Kasserers navn", order.cashierName ?? "")}
      ${detailLine("Kasserers telefon", order.cashierPhone ?? "")}
      ${detailLine("Status", formatStatus(order.status))}
      ${detailLine("Bestillingsdato", formatDateNorwegian(order.createdAt))}

      ${renderOrderItems(order, items)}

      <div style="margin-top:20px;">
        ${detailLine("Total", formatMoneyNok(priceExVat))}
        ${detailLine("MVA (25%)", formatMoneyNok(vat))}
        ${detailLine("Total inkl. MVA", formatMoneyNok(totalIncVat))}
      </div>

      <p style="margin:22px 0 0 0;">For å se bestillingen, logg inn.</p>

      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 16px 0;">
          Med vennlig hilsen,<br/>
          Otman Transport AS | otman.no<br/>
          +47 402 84 977 | bestilling@otman.no
        </p>

        <div style="margin-top:12px;">
          <img
            src="https://otman.no/wp-content/uploads/2023/12/logo-removebg.png"
            alt="Otman Transport Logo"
            style="display:block;max-height:48px;width:auto;"
          />
        </div>
      </div>
    </div>
  `;

  await sendEmail({
    to: {
      email: ORDER_NOTIFICATION_EMAIL,
    },
    subject,
    html,
  });
}
