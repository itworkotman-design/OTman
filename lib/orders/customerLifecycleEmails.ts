import { getGmailSendAsEmail } from "@/lib/email/gmailAccounts";
import { getOrderEmailLogoUrl } from "@/lib/email/emailAssets";
import { getOrderActionBaseUrl } from "@/lib/stripe/stripeClient";

export type LifecycleEmailOrder = {
  id: string;
  displayId: number | null;
  customerName: string | null;
  customerLabel: string | null;
  statusNotes: string | null;
  actionToken: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildSimpleEmailShell(content: string) {
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

function buttonLink(url: string, label: string, color = "#273097") {
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

function customerGreetingName(order: LifecycleEmailOrder) {
  return order.customerName?.trim() || order.customerLabel?.trim() || "kunde";
}

function orderReference(order: LifecycleEmailOrder) {
  return typeof order.displayId === "number" ? `#${order.displayId}` : "";
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
