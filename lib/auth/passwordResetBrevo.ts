import { registerPasswordResetDeliveryAdapter } from "@/lib/auth/passwordResetDelivery";

function buildPasswordResetHtml(resetUrl: string) {
  return `
    <!DOCTYPE html>
    <html>
      <body style="margin:0; padding:0; font-family:Arial,sans-serif; background:#f7f7f7;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
          <tr>
            <td align="center">
              <table width="680" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:24px; overflow:hidden;">
                <tr>
                  <td style="background-color:#273097; padding:28px 40px;">
                    <h1 style="margin:0; color:white; font-size:24px;">Otman Transport</h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:40px;">
                    <p style="margin:0 0 16px 0; font-size:20px; font-weight:bold; color:#273097;">
                      Reset your password
                    </p>

                    <p style="margin:0 0 24px 0; font-size:15px; color:#444; line-height:1.6;">
                      We received a request to reset your password. Click the button below to choose a new password.
                    </p>

                    <p style="margin:0 0 24px 0;">
                      <a
                        href="${resetUrl}"
                        style="display:inline-block; background:#273097; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:10px; font-weight:bold;"
                      >
                        Reset password
                      </a>
                    </p>

                    <p style="margin:0; font-size:14px; color:#666; line-height:1.6;">
                      If you did not request this, you can ignore this email.
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

export function registerBrevoPasswordResetDelivery() {
  registerPasswordResetDeliveryAdapter(async ({ email, resetUrl }) => {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY!,
      },
      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_SENDER_NAME!,
          email: process.env.BREVO_SENDER_EMAIL!,
        },
        to: [{ email }],
        subject: "Reset your password",
        htmlContent: buildPasswordResetHtml(resetUrl),
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Brevo password reset email failed: ${errorText}`);
    }
  });
}