import { NextRequest, NextResponse } from "next/server";
import type { OrderRow } from "@/lib/_mockdb";

const EMAIL_MESSAGES: Record<string, string> = {
  prepare_orders:     "Vennligst klargjør disse bestillingene som er vedlagt nedenfor for henting.",
  confirmed_delivery: "Bestillingene som er vedlagt nedenfor er bekreftet for levering.",
};

function buildOrderTable(orders: OrderRow[]): string {
  const rows = orders.map((o) => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 8px;">${o.deliveryDate}</td>
      <td style="padding: 8px;">${o.timeWindow}</td>
      <td style="padding: 8px;">${o.customer}</td>
      <td style="padding: 8px;">${o.orderNo}</td>
      <td style="padding: 8px;">${o.name}</td>
      <td style="padding: 8px;">${o.phone}</td>
      <td style="padding: 8px;">${o.pickupAddress}</td>
      <td style="padding: 8px;">${o.extraPickup || "—"}</td>
      <td style="padding: 8px;">${o.deliveryAddress}</td>
      <td style="padding: 8px;">${o.returnAddress || "—"}</td>
      <td style="padding: 8px;">${o.products.join(", ")}</td>
      <td style="padding: 8px;">${o.cashierName || "—"}</td>
      <td style="padding: 8px;">${o.priceExVat}</td>
    </tr>
  `).join("");

  return `
    <table style="width:100%; border-collapse: collapse; font-size: 13px; margin-top: 24px;">
      <thead>
        <tr style="background-color: #273097; color: white;">
          <th style="padding: 10px; text-align:left;">Leveringsdato</th>
          <th style="padding: 10px; text-align:left;">Tidsvindu for levering</th>
          <th style="padding: 10px; text-align:left;">Customer</th>
          <th style="padding: 10px; text-align:left;">Bilagsnummer</th>
          <th style="padding: 10px; text-align:left;">Kundens Navn</th>
          <th style="padding: 10px; text-align:left;">Kundens Telefon</th>
          <th style="padding: 10px; text-align:left;">Henteadresse</th>
          <th style="padding: 10px; text-align:left;">Ekstra hentesteder</th>
          <th style="padding: 10px; text-align:left;">Leveringsadresse</th>
          <th style="padding: 10px; text-align:left;">Returadresse</th>
          <th style="padding: 10px; text-align:left;">Produkter</th>
          <th style="padding: 10px; text-align:left;">Kasserers navn</th>
          <th style="padding: 10px; text-align:left;">Pris uten MVA</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildEmailHtml(recipientName: string, message: string, orders: OrderRow[]): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0; padding:0;">

      <table width="100%" cellpadding="0" cellspacing="0" style=" padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="680" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:24px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
              
              <!-- Header -->
              <tr>
                <td style="background-color:#273097; padding: 28px 40px; text-align:left;">
                  <img 
                    src="https://otman.no/wp-content/uploads/2023/12/logo-removebg.png" 
                    alt="Otman Transport AS" 
                    width="160"
                    style="display:block;"
                  />
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 40px;">
                  <p style="margin:0 0 8px 0; font-family:Arial,sans-serif; font-size:20px; font-weight:bold; color:#273097;">
                    Hei ${recipientName},
                  </p>
                  <p style="margin: 16px 0 32px 0; font-family:Arial,sans-serif; font-size:15px; color:#444444; line-height:1.6;">
                    ${message}
                  </p>

                  <!-- Order table -->
                  ${buildOrderTable(orders)}

                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <hr style="border:none; border-top:1px solid #eeeeee; margin:0;" />
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 28px 40px; background-color:#fafafa;">
                  <p style="margin:0 0 4px 0; font-family:Arial,sans-serif; font-size:13px; color:#888888;">
                    Med vennlig hilsen,
                  </p>
                  <p style="margin:0 0 12px 0; font-family:Arial,sans-serif; font-size:14px; font-weight:bold; color:#273097;">
                    Otman Transport AS
                  </p>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-right:16px;">
                        <a href="https://otman.no/" style="font-family:Arial,sans-serif; font-size:13px; color:#273097; text-decoration:none;">
                           otman.no |
                        </a>
                      </td>
                      <td style="padding-right:16px;">
                        <span style="font-family:Arial,sans-serif; font-size:13px; color:#888888;">
                           +47 402 84 977 |
                        </span>
                      </td>
                      <td>
                        <a href="mailto:bestilling@otman.no" style="font-family:Arial,sans-serif; font-size:13px; color:#273097; text-decoration:none;">
                           bestilling@otman.no
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Bottom bar -->
              <tr>
                <td style="padding:12px 40px; text-align:center;">
                  <p style="margin:0; font-family:Arial,sans-serif; font-size:11px; color:rgba(163, 163, 163);">
                    Dette er en automatisk generert e-post fra Otman Transport AS
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>

    </body>
    </html>
  `;
}

export async function POST(req: NextRequest) {
  try {
    const { recipientName, recipientEmail, type, customMessage, orders } = await req.json();

    const message = EMAIL_MESSAGES[type] ?? type;
    const html = buildEmailHtml(recipientName, message, orders);

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY!,
      },
      body: JSON.stringify({
        sender: {
          name:  process.env.BREVO_SENDER_NAME!,
          email: process.env.BREVO_SENDER_EMAIL!,
        },
        to: [{ name: recipientName, email: recipientEmail }],
        subject: type === "custom"
          ? "Melding"
          : type === "prepare_orders"
          ? "Klargjør bestillinger"
          : "Bekreftet for levering",
        htmlContent: html,
      }),
    });

    if (!res.ok) {
        const error = await res.json();
        console.error("Brevo error:", JSON.stringify(error, null, 2));
        return NextResponse.json({ success: false, error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}