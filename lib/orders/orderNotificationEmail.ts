import { sendEmail } from "@/lib/email/sendEmail";
import type { BuiltOrderItem } from "@/lib/orders/buildOrderItemsFromCards";

export const ORDER_NOTIFICATION_EMAIL =
  process.env.ORDER_NOTIFICATION_EMAIL?.trim() || "itworkotman@gmail.com";

export type NotificationOrder = {
  id: string;
  displayId?: number | null;
  orderNumber?: string | null;
  customerLabel?: string | null;
  customerEmail?: string | null;
  deliveryDate?: string | null;
  pickupAddress?: string | null;
  extraPickupAddress?: string[] | null;
  deliveryAddress?: string | null;
  returnAddress?: string | null;
  drivingDistance?: string | null;
  timeWindow?: string | null;
  expressDelivery?: boolean | null;
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

type ExtraPickupNotificationRecipient = {
  address: string;
  phone?: string | null;
  email: string;
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

function renderOrderItemsSimple(
  order: NotificationOrder,
  items: BuiltOrderItem[],
) {
  const grouped = groupItemsByCard(items);

  if (grouped.length === 0) {
    return order.productsSummary
      ? `<p style="margin:0 0 12px 0;"><strong>Produkter:</strong> ${escapeHtml(order.productsSummary)}</p>`
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
        productCardRawData && typeof productCardRawData.hoursInput === "number"
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
        <p style="margin:0 0 8px 0;"><strong>${escapeHtml(`${productHeading}${quantitySuffix}${laborSuffix}`)}</strong></p>
        ${optionLines ? `<ul style="margin:0 0 12px 0;padding:0;">${optionLines}</ul>` : `<p style="margin:0 0 12px 0;"></p>`}
      `;
    })
    .join("");
}

function buildOrderEmailLines(
  order: NotificationOrder,
  reference: string,
): [string, string][] {
  const priceExVat =
    typeof order.priceExVat === "number" ? order.priceExVat : null;
  const vat = typeof priceExVat === "number" ? priceExVat * 0.25 : null;
  const totalIncVat =
    typeof priceExVat === "number" && typeof vat === "number"
      ? priceExVat + vat
      : null;

  const lines: [string, string][] = [
    [
      "Bestiller",
      [order.customerLabel, order.customerEmail]
        .filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0,
        )
        .join(" - "),
    ] as [string, string],
    ["Leveringsdato", formatDateNorwegian(order.deliveryDate)],
    ["Henteadresse", order.pickupAddress ?? ""],
    [
      "Ekstra hentesteder",
      Array.isArray(order.extraPickupAddress) &&
      order.extraPickupAddress.length > 0
        ? order.extraPickupAddress.join(", ")
        : "",
    ],
    ["Leveringsadresse", order.deliveryAddress ?? ""],
    ["Returadresse", order.returnAddress ?? ""],
    ["Total kjøreavstand", order.drivingDistance ?? ""],
    ["Tidsvindu for levering", order.timeWindow ?? ""],
    ["Ekspresslevering", order.expressDelivery ? "Ja" : ""],
    ["Bestillingsnummer", order.orderNumber?.trim() ?? ""] as [string, string],
    ["Beskrivelse", order.description ?? ""],
    ["Kundens navn", order.customerName ?? ""],
    ["E-postadresse", order.email ?? ""],
    ["Telefon", order.phone ?? ""],
    ["Etasje nr", order.floorNo ?? ""],
    ["Heis", formatLift(order.lift)],
    ["Kasserers navn", order.cashierName ?? ""],
    ["Kasserers telefon", order.cashierPhone ?? ""],
    ["Status", formatStatus(order.status)],
    ["Bestillingsdato", formatDateNorwegian(order.createdAt)],
    ["Total", formatMoneyNok(priceExVat)],
    ["MVA (25%)", formatMoneyNok(vat)],
    ["Total inkl. MVA", formatMoneyNok(totalIncVat)],
  ];

  return lines.filter(([, value]) => value && String(value).trim().length > 0);
}

function renderSimpleLines(lines: Array<[string, string]>) {
  return lines
    .map(
      ([label, value]) =>
        `<p style="margin:0 0 10px 0;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</p>`,
    )
    .join("");
}

function buildSimpleEmailShell(content: string) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;text-align:left;">
      ${content}
      <p style="margin:20px 0 0 0;">Med vennlig hilsen,</p>
      <p style="margin:0;">
        Otman Transport AS<br/>
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
  `;
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
  const heading =
    kind === "created"
      ? "Du har fått en ny bestilling."
      : "En bestilling har blitt oppdatert.";
  const subjectOrderId =
    typeof order.displayId === "number" ? String(order.displayId) : order.id;

  const subject = `${titlePrefix} #${subjectOrderId} fra ${customer}`;

  const lines = buildOrderEmailLines(order, reference);

  const html = buildSimpleEmailShell(`
    <p style="margin:0 0 16px 0;">Hei,</p>
    <p style="margin:0 0 16px 0;">${escapeHtml(heading)}</p>
    ${renderSimpleLines(lines)}
    ${renderOrderItemsSimple(order, items)}
    <p style="margin:16px 0 0 0;">For å se bestillingen, logg inn.</p>
  `);

  await sendEmail({
    to: {
      email: ORDER_NOTIFICATION_EMAIL,
    },
    subject,
    html,
  });
}

export async function sendExtraPickupNotificationEmail({
  order,
  extraPickup,
}: {
  order: NotificationOrder;
  extraPickup: ExtraPickupNotificationRecipient;
}) {
  const subjectOrderId =
    typeof order.displayId === "number" ? String(order.displayId) : order.id;

  const subject = `Ordre #${subjectOrderId} – ekstra henting`;

  const lines = [
    ["Bestillingsnummer", order.orderNumber?.trim() ?? ""] as [string, string],
    [
      "Bestiller",
      [order.customerLabel, order.customerEmail]
        .filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0,
        )
        .join(" - "),
    ] as [string, string],
    ["Kundens navn", order.customerName ?? ""] as [string, string],
    ["Leveringsdato", formatDateNorwegian(order.deliveryDate)] as [
      string,
      string,
    ],
    ["Tidsvindu for levering", order.timeWindow ?? ""] as [string, string],
    ["Ekstra henteadresse", extraPickup.address] as [string, string],
    ["Kontakttelefon", extraPickup.phone ?? ""] as [string, string],
    ["Leveringsadresse", order.deliveryAddress ?? ""] as [string, string],
    ["Beskrivelse", order.description ?? ""] as [string, string],
    ["Kunde e-post", order.email ?? ""] as [string, string],
    ["Kunde telefon", order.phone ?? ""] as [string, string],
  ].filter(([, value]) => value && String(value).trim().length > 0);

  const html = buildSimpleEmailShell(`
    <p style="margin:0 0 16px 0;">Hei,</p>
    <p style="margin:0 0 16px 0;">Du har fått informasjon om en bestilling med ekstra henting.</p>
    ${renderSimpleLines(lines)}
  `);

  await sendEmail({
    to: {
      email: extraPickup.email,
    },
    subject,
    html,
  });
}
