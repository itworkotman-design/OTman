// lib/orders/selectedOrdersEmailHtml.ts
// HTML for the "selected orders" summary email: a greeting, an optional
// message, one table per order and the Otman footer. Shared by
// /api/orders/send-selected-email and /api/orders/send-prepare-email.
import { getGmailSendAsEmail } from "@/lib/email/gmailAccounts";
import { getOrderEmailLogoUrl } from "@/lib/email/emailAssets";
import { getPricingSnapshotCustomerTotal } from "@/lib/orders/orderTotals";

export type SelectedOrderEmailOrder = Parameters<typeof formatOrderBlockHtml>[0];

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPriceNok(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return `NOK ${value.toLocaleString("nb-NO")}`;
}

function formatDateNorwegian(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatTimeWindow(value?: string | null) {
  if (!value) return "";
  return value.replace("-", " - ");
}

function tableRow(label: string, value?: string | null) {
  if (!value) return "";
  return `
    <tr>
      <td style="padding:10px 12px;border:1px solid #dbe3f0;background:#f8fafc;font-weight:700;width:220px;vertical-align:top;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:10px 12px;border:1px solid #dbe3f0;vertical-align:top;">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
}
function formatOrderBlockHtml(order: {
  displayId?: number | null;
  orderNumber?: string | null;
  deliveryDate?: string | null;
  timeWindow?: string | null;
  customerLabel?: string | null;
  customerName?: string | null;
  phone?: string | null;
  pickupAddress?: string | null;
  extraPickupAddress?: string[] | null;
  deliveryAddress?: string | null;
  returnAddress?: string | null;
  productsSummary?: string | null;
  cashierName?: string | null;
  priceExVat?: number | null;
  pricingSnapshot?: unknown;
}) {
  const extraPickupAddress =
    Array.isArray(order.extraPickupAddress) &&
    order.extraPickupAddress.length > 0
      ? order.extraPickupAddress.join(", ")
      : "";
  const snapshotPriceExVat = getPricingSnapshotCustomerTotal(
    order.pricingSnapshot,
  );
  const displayPriceExVat =
    typeof order.priceExVat === "number"
      ? snapshotPriceExVat ?? order.priceExVat
      : null;

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="border-collapse:collapse;margin:0 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;">
      <tr>
        <td colspan="2" style="padding:12px 14px;background:#273097;color:#ffffff;font-weight:700;font-size:15px;">
          Bestilling${order.displayId ? ` - ID ${order.displayId}` : ""}
        </td>
      </tr>

      ${tableRow("Leveringsdato", formatDateNorwegian(order.deliveryDate))}
      ${tableRow("Tidsvindu for levering", formatTimeWindow(order.timeWindow))}
      ${tableRow("Customer", order.customerLabel)}
      ${tableRow("Power Bilagsnummer", order.orderNumber)}
      ${tableRow("Kundens Navn", order.customerName)}
      ${tableRow("Kundens Telefon", order.phone)}
      ${tableRow("Henteadresse", order.pickupAddress)}
      ${tableRow("Ekstra hentesteder", extraPickupAddress)}
      ${tableRow("Leveringsadresse", order.deliveryAddress)}
      ${tableRow("Returadresse", order.returnAddress)}
      ${tableRow("Produkter", order.productsSummary)}
      ${tableRow("Kasserers navn", order.cashierName)}
      ${tableRow("Pris uten MVA", formatPriceNok(displayPriceExVat))}
    </table>
  `;
}

export function buildSelectedOrdersEmailHtml({
  greetingName,
  message,
  orders,
}: {
  greetingName: string;
  message: string;
  orders: SelectedOrderEmailOrder[];
}) {
  const logoUrl = getOrderEmailLogoUrl();

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;max-width:900px;margin:0 auto;">
      <p style="margin:0 0 16px 0;">Hei ${escapeHtml(greetingName)},</p>

      ${
        message
          ? `<p style="margin:0 0 20px 0;">${escapeHtml(message)}</p>`
          : ""
      }

      ${orders.map((order) => formatOrderBlockHtml(order)).join("")}

      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 10px 0;">
          For å se bestillingen din:
        </p>

        <div style="margin:10px 0 20px 0;">
          <a href="https://otman.no/login"
            style="
              display:inline-block;
              background-color:#273097;
              color:#ffffff;
              padding:12px 20px;
              text-decoration:none;
              font-weight:600;
              border-radius:6px;
              font-family:Arial,Helvetica,sans-serif;
              font-size:14px;
            ">
            Logg inn
          </a>
        </div>

        <p style="margin:0 0 16px 0;">
          Med vennlig hilsen,<br/>
          Otman AS | otman.no<br/>
          +47 402 84 977 | ${getGmailSendAsEmail()}
        </p>

        <div style="margin-top:12px;">
          <img
            src="${escapeHtml(logoUrl)}"
            alt="Otman AS Logo"
            style="display:block;max-height:48px;width:auto;"
          />
        </div>
      </div>
    </div>
  `;;
}
