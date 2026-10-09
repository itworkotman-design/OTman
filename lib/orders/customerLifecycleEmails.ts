import { formatKr } from "./orderChangeText";
import { formatOrderDate } from "./formatOrderDate";
import { getEditCutoff } from "./customerOrderEditPolicy";
import { localizeProductsSummary, localizeWebsiteLineLabelList } from "@/lib/content/websiteLineLabels";
import { getGmailSendAsEmail } from "@/lib/email/gmailAccounts";
import { getOrderEmailLogoUrl } from "@/lib/email/emailAssets";
import { getOrderActionBaseUrl } from "@/lib/stripe/stripeClient";

export type LifecycleEmailOrder = {
  id: string;
  displayId: number | null;
  // The random public number customers see (Order.orderNumber). Older orders
  // may not have one — those fall back to the internal displayId.
  orderNumber?: string | null;
  customerName: string | null;
  customerLabel: string | null;
  statusNotes: string | null;
  actionToken: string | null;
  // balance_due only: the explicit breakdown (see compareOrderWithPayments).
  // Without it the email falls back to the generic "pay the rest" wording.
  balanceDue?: {
    paidIncVatNok: number;
    totalIncVatNok: number;
    amountDueIncVatNok: number;
    // Ready-made lines from lib/orders/orderChangeText.ts.
    changes: string[];
  };
  // order_received only: the order's temporary customer account ("My order",
  // lib/customerAccounts/). `password` is the one just generated (null = a
  // returning customer keeps theirs). It is masked in the copy logged on the
  // order — see sendCustomerLifecycleEmail.ts.
  customerLogin?: { email: string; password: string | null };
  // order_received only: the "Bestillingsdetaljer" table at the end.
  orderDetails?: OrderReceivedDetails;
  // order_updated only: what the customer changed, and the new total (null =
  // the order has no price, e.g. a quote).
  orderUpdate?: { changes: string[]; totalIncVatNok: number | null };
};

export type OrderReceivedDetails = {
  deliveryDate: string | null;
  timeWindow: string | null;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  pickupAddress: string | null;
  extraPickupAddress: string[];
  deliveryAddress: string | null;
  returnAddress: string | null;
  floorNo: string | null;
  lift: string | null;
  productsSummary: string | null;
  deliveryTypeSummary: string | null;
  servicesSummary: string | null;
  customerComments: string | null;
  // null = not priced yet (a quote).
  totalIncVatNok: number | null;
};

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildSimpleEmailShell(content: string) {
  const logoUrl = getOrderEmailLogoUrl();

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;text-align:left;">
      ${content}
      <p style="margin:20px 0 0 0;">Med vennlig hilsen,</p>
      <p style="margin:0;">
        Otman AS<br/>
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
  `;
}

export function buttonLink(url: string, label: string, color = "#273097") {
  return `
    <a href="${escapeHtml(url)}"
      style="display:inline-block;background-color:${color};color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:600;border-radius:6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;margin:6px 8px 6px 0;">
      ${escapeHtml(label)}
    </a>
  `;
}

function requireActionToken(order: LifecycleEmailOrder): string {
  if (!order.actionToken) {
    throw new Error(`Order ${order.id} has no actionToken — cannot build a customer action link`);
  }

  return order.actionToken;
}

export function buildOrderActionUrls(token: string) {
  const baseUrl = getOrderActionBaseUrl();

  return {
    payUrl: `${baseUrl}/betaling/${token}`,
    cancelUrl: `${baseUrl}/bestilling/avbryt/${token}`,
    requestChangeUrl: `${baseUrl}/bestilling/endre/${token}`,
  };
}

// "My order" pages (app/(site)/[locale]/min-bestilling). Un-prefixed like
// the other action links — proxy.ts adds the default locale.
export function buildCustomerOrderUrls(orderNumber: string) {
  const baseUrl = getOrderActionBaseUrl();

  return {
    orderUrl: `${baseUrl}/min-bestilling/${encodeURIComponent(orderNumber)}`,
    forgotPasswordUrl: `${baseUrl}/min-bestilling/logg-inn?glemt=1`,
  };
}

export function customerGreetingName(order: Pick<LifecycleEmailOrder, "customerName" | "customerLabel">) {
  return order.customerName?.trim() || order.customerLabel?.trim() || "kunde";
}

export function orderReference(order: Pick<LifecycleEmailOrder, "orderNumber" | "displayId">) {
  const orderNumber = order.orderNumber?.trim();
  if (orderNumber) return `#${orderNumber}`;
  return typeof order.displayId === "number" ? `#${order.displayId}` : "";
}

// Sent once, right after the first successful payment confirms an order.
// There was previously no customer-facing email at all between submission
// and approval/rejection/payment — this closes that gap, and specifically
// gives the customer a durable link to request a change or addition later
// (bestilling/endre/[token] is reachable from "confirmed" status — see
// docs/homepage-ordering-roadmap.md §4), since no other email they'll have
// received contains that link once they're this far along.
export function buildOrderConfirmedEmail(order: LifecycleEmailOrder) {
  const { requestChangeUrl } = buildOrderActionUrls(requireActionToken(order));
  const reference = orderReference(order);

  const subject = `Bestilling ${reference} er bekreftet — takk!`.trim();
  const html = buildSimpleEmailShell(`
    <p style="margin:0 0 16px 0;">Hei ${escapeHtml(customerGreetingName(order))},</p>
    <p style="margin:0 0 16px 0;">
      Bestillingen din ${escapeHtml(reference)} er bekreftet og betalt. Takk for at du valgte Otman!
    </p>
    <p style="margin:0 0 16px 0;">
      Trenger du å legge til noe eller gjøre en endring senere? Bruk lenken under.
    </p>
    <div style="margin:20px 0;">${buttonLink(requestChangeUrl, "Be om endring")}</div>
  `);

  return { subject, html };
}

export function buildPaymentRequestEmail(order: LifecycleEmailOrder) {
  const { payUrl } = buildOrderActionUrls(requireActionToken(order));
  const reference = orderReference(order);

  const subject = `Din bestilling ${reference} er godkjent — betal for å bekrefte`.trim();
  const html = buildSimpleEmailShell(`
    <p style="margin:0 0 16px 0;">Hei ${escapeHtml(customerGreetingName(order))},</p>
    <p style="margin:0 0 16px 0;">
      Din bestilling ${escapeHtml(reference)} er godkjent. For å bekrefte bestillingen, betal med kort via lenken under.
    </p>
    <div style="margin:20px 0;">${buttonLink(payUrl, "Betal nå")}</div>
    <p style="margin:16px 0 0 0;">Har du spørsmål? Bare svar på denne e-posten.</p>
  `);

  return { subject, html };
}

export function buildRejectedEmail(order: LifecycleEmailOrder) {
  const { cancelUrl, requestChangeUrl } = buildOrderActionUrls(requireActionToken(order));
  const reference = orderReference(order);
  const comment = order.statusNotes?.trim();

  const subject = `Din bestilling ${reference} krever din oppmerksomhet`.trim();
  const html = buildSimpleEmailShell(`
    <p style="margin:0 0 16px 0;">Hei ${escapeHtml(customerGreetingName(order))},</p>
    <p style="margin:0 0 16px 0;">
      Vi kan dessverre ikke gå videre med bestillingen ${escapeHtml(reference)} slik den er nå.
    </p>
    ${comment ? `<p style="margin:0 0 16px 0;font-style:italic;">"${escapeHtml(comment)}"</p>` : ""}
    <p style="margin:0 0 16px 0;">Velg et av alternativene under:</p>
    <div style="margin:20px 0;">
      ${buttonLink(requestChangeUrl, "Be om endring")}
      ${buttonLink(cancelUrl, "Kanseller bestilling", "#b91c1c")}
    </div>
  `);

  return { subject, html };
}

// Sent when staff change an order that's already confirmed (paid) — there's
// a remaining balance to collect. With `balanceDue` (the admin editor passes
// it) the email spells out what was paid, the new total, exactly what's due
// now and what changed; the payment page shows the same, and is what charges.
export function buildBalanceDueEmail(order: LifecycleEmailOrder) {
  const { payUrl } = buildOrderActionUrls(requireActionToken(order));
  const reference = orderReference(order);
  const due = order.balanceDue;

  const subject = `Bestilling ${reference} er oppdatert — betal restbeløpet`.trim();
  const row = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 16px 4px 0;">${escapeHtml(label)}</td><td style="padding:4px 0;text-align:right;${bold ? "font-weight:700;" : ""}">${escapeHtml(value)}</td></tr>`;
  const breakdown = due
    ? `
    ${
      due.changes.length > 0
        ? `<p style="margin:0 0 8px 0;font-weight:600;">Dette er endret siden du betalte:</p>
    <ul style="margin:0 0 16px 0;padding-left:20px;">${due.changes.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`
        : ""
    }
    <table style="margin:0 0 16px 0;border-collapse:collapse;font-size:14px;">
      ${row("Betalt så langt", formatKr(due.paidIncVatNok))}
      ${row("Ny totalpris (inkl. MVA)", formatKr(due.totalIncVatNok))}
      ${row("Å betale nå", formatKr(due.amountDueIncVatNok), true)}
    </table>`
    : "";
  const html = buildSimpleEmailShell(`
    <p style="margin:0 0 16px 0;">Hei ${escapeHtml(customerGreetingName(order))},</p>
    <p style="margin:0 0 16px 0;">
      Bestillingen din ${escapeHtml(reference)} er oppdatert. Betal restbeløpet via lenken under for å bekrefte.
    </p>${breakdown}
    <div style="margin:20px 0;">${buttonLink(payUrl, "Betal restbeløp")}</div>
    <p style="margin:16px 0 0 0;">Har du spørsmål? Bare svar på denne e-posten.</p>
  `);

  return { subject, html };
}

export function buildPaymentTimeoutEmail(order: LifecycleEmailOrder) {
  const { payUrl, cancelUrl, requestChangeUrl } = buildOrderActionUrls(requireActionToken(order));
  const reference = orderReference(order);

  const subject = `Påminnelse: betaling for bestilling ${reference}`.trim();
  const html = buildSimpleEmailShell(`
    <p style="margin:0 0 16px 0;">Hei ${escapeHtml(customerGreetingName(order))},</p>
    <p style="margin:0 0 16px 0;">
      Vi har ikke mottatt betaling for bestillingen ${escapeHtml(reference)} ennå. Velg et av alternativene under:
    </p>
    <div style="margin:20px 0;">
      ${buttonLink(payUrl, "Betal nå")}
      ${buttonLink(requestChangeUrl, "Be om endring")}
      ${buttonLink(cancelUrl, "Kanseller bestilling", "#b91c1c")}
    </div>
  `);

  return { subject, html };
}

// "torsdag 14. oktober kl. 10:00" (Oslo time).
function formatCutoff(cutoff: Date): string {
  const date = cutoff.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Oslo" });
  const time = cutoff.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Oslo" });
  return `${date} kl. ${time.replace(".", ":")}`;
}

// What the customer may do in "My order" and until when — the rules of
// customerOrderEditPolicy.ts (and the cancel route) in words.
function editRulesBlock(details: OrderReceivedDetails | undefined) {
  const cutoff = getEditCutoff(details?.deliveryDate, details?.timeWindow);
  const until = cutoff ? `Frem til ${escapeHtml(formatCutoff(cutoff))} (24 timer før leveringen)` : "Frem til 24 timer før leveringen";
  return `
    <p style="margin:0 0 16px 0;">
      ${until} kan du endre dato, adresser og varer, eller avbestille bestillingen. Etter det kan du fortsatt
      legge til tjenester og oppdatere kontaktinformasjonen din — vil du avbestille da, sender du oss en forespørsel.
    </p>`;
}

function detailsRow(label: string, value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return "";
  return `
      <tr>
        <td style="padding:8px 12px;border:1px solid #dbe3f0;background:#f8fafc;font-weight:700;width:180px;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:8px 12px;border:1px solid #dbe3f0;vertical-align:top;white-space:pre-line;">${escapeHtml(text)}</td>
      </tr>`;
}

// Same look as the dashboard's "send selected orders" table, in the
// customer's words: every address, what is delivered and the total.
function orderDetailsTable(details: OrderReceivedDetails) {
  const date = [details.deliveryDate ? formatOrderDate(details.deliveryDate, "no") : null, details.timeWindow?.replace("-", " - ")]
    .filter(Boolean)
    .join(", ");
  const floor = [details.floorNo?.trim() ? `${details.floorNo.trim()}. etasje` : null, details.lift?.trim() ? `heis: ${details.lift.trim()}` : null]
    .filter(Boolean)
    .join(", ");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="border-collapse:collapse;margin:24px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;">
      <tr>
        <td colspan="2" style="padding:12px 14px;background:#273097;color:#ffffff;font-weight:700;font-size:15px;">Bestillingsdetaljer</td>
      </tr>
      ${detailsRow("Leveringsdato", date)}
      ${detailsRow("Henteadresse", details.pickupAddress)}
      ${detailsRow(details.extraPickupAddress.length > 1 ? "Ekstra hentesteder" : "Ekstra hentested", details.extraPickupAddress.join("\n"))}
      ${detailsRow("Leveringsadresse", details.deliveryAddress)}
      ${detailsRow("Etasje", floor)}
      ${detailsRow("Returadresse", details.returnAddress)}
      ${detailsRow("Varer", localizeProductsSummary(details.productsSummary, "no"))}
      ${detailsRow("Levering", localizeWebsiteLineLabelList(details.deliveryTypeSummary, "no"))}
      ${detailsRow("Tjenester", localizeWebsiteLineLabelList(details.servicesSummary, "no"))}
      ${detailsRow("Navn", details.customerName)}
      ${detailsRow("Telefon", details.phone)}
      ${detailsRow("E-post", details.email)}
      ${detailsRow("Kommentar", details.customerComments)}
      ${detailsRow("Totalpris (inkl. MVA)", details.totalIncVatNok !== null ? formatKr(details.totalIncVatNok) : null)}
    </table>`;
}

// The one email a customer gets right after placing a website order: the
// confirmation, their "My order" login (username and, for a new account, the
// password), what they can still change and until when, and the full order.
// No token action links: no actionToken exists yet. A reply is the customer's
// other way to reach us — Reply-To is the order's Email Center thread, so it
// lands on the order. Works for priced and quote-only flows alike.
export function buildOrderReceivedEmail(order: LifecycleEmailOrder) {
  const reference = orderReference(order);
  const orderNumber = order.orderNumber?.trim();

  const loginBlock =
    order.customerLogin && orderNumber
      ? (() => {
          const { orderUrl, forgotPasswordUrl } = buildCustomerOrderUrls(orderNumber);
          const password = order.customerLogin.password
            ? `Passord: <strong style="font-family:monospace;font-size:16px;">${escapeHtml(order.customerLogin.password)}</strong>`
            : `Logg inn med passordet du allerede har. <a href="${escapeHtml(forgotPasswordUrl)}" style="color:#273097;">Glemt passord?</a>`;
          return `
    <p style="margin:0 0 16px 0;">
      Under <strong>Min bestilling</strong> kan du se bestillingen og legge til tjenester i tilfelle du har glemt noe,
      eller endre den hvis du har bestilt noe for mye. Du kan alltid kontakte oss for hjelp!
    </p>
    <p style="margin:0 0 8px 0;">Brukernavn: <strong>${escapeHtml(order.customerLogin.email)}</strong><br/>${password}</p>
    <div style="margin:16px 0;">${buttonLink(orderUrl, "Gå til Min bestilling")}</div>
    <p style="margin:0 0 16px 0;">
      Innloggingen slettes automatisk kort tid etter at bestillingen er levert og fullført. Ikke del passordet med andre.
    </p>${editRulesBlock(order.orderDetails)}`;
        })()
      : "";

  const subject = `Takk for bestillingen ${reference}`.trim();
  const html = buildSimpleEmailShell(`
    <p style="margin:0 0 16px 0;">Hei ${escapeHtml(customerGreetingName(order))},</p>
    <p style="margin:0 0 16px 0;">
      Takk for bestillingen! Vi har mottatt ${reference ? `bestilling ${escapeHtml(reference)}` : "bestillingen din"} og behandler den nå.
    </p>${loginBlock}
    <p style="margin:0 0 16px 0;">Har du spørsmål eller vil du endre noe? Bare svar på denne e-posten.</p>
    ${order.orderDetails ? orderDetailsTable(order.orderDetails) : ""}
  `);

  return { subject, html };
}

// Sent after the customer changed their own order in "My order" — a record
// of exactly what changed (the same lines staff see on the order).
export function buildOrderUpdatedEmail(order: LifecycleEmailOrder) {
  const reference = orderReference(order);
  const orderNumber = order.orderNumber?.trim();
  const update = order.orderUpdate ?? { changes: [], totalIncVatNok: null };

  const subject = `Bestilling ${reference} er endret`.trim();
  const changes =
    update.changes.length > 0
      ? `<ul style="margin:0 0 16px 0;padding-left:20px;">${update.changes.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`
      : "";
  const total =
    update.totalIncVatNok !== null
      ? `<p style="margin:0 0 16px 0;">Ny totalpris (inkl. MVA): <strong>${escapeHtml(formatKr(update.totalIncVatNok))}</strong></p>`
      : "";
  const link = orderNumber
    ? `<div style="margin:20px 0;">${buttonLink(buildCustomerOrderUrls(orderNumber).orderUrl, "Se bestillingen")}</div>`
    : "";
  const html = buildSimpleEmailShell(`
    <p style="margin:0 0 16px 0;">Hei ${escapeHtml(customerGreetingName(order))},</p>
    <p style="margin:0 0 16px 0;">Bestillingen din ${escapeHtml(reference)} er endret:</p>
    ${changes}${total}${link}
    <p style="margin:16px 0 0 0;">Var det ikke du som gjorde endringen? Svar på denne e-posten med en gang.</p>
  `);

  return { subject, html };
}
