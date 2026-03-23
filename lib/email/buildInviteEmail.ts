export function buildInviteEmail({
  inviteUrl,
  companyName,
  role,
  recipientEmail,
}: {
  inviteUrl: string;
  companyName: string;
  role: string;
  recipientEmail: string;
}) {
  return {
    subject: `You have been invited to ${companyName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <body style="margin:0; padding:0; background:#f7f7f7; font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
            <tr>
              <td align="center">
                <table width="680" cellpadding="0" cellspacing="0" style="background:#fff; border-radius:24px; overflow:hidden;">
                  <tr>
                    <td style="background:#273097; padding:28px 40px;">
                      <div style="font-size:24px; font-weight:bold; color:#fff;">
                        Otman Transport
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:40px;">
                      <p style="margin:0 0 16px 0; font-size:20px; font-weight:bold; color:#273097;">
                        Hello,
                      </p>

                      <p style="margin:0 0 16px 0; font-size:15px; color:#444; line-height:1.6;">
                        <strong>${recipientEmail}</strong> has been invited to join
                        <strong>${companyName}</strong> as <strong>${role}</strong>.
                      </p>

                      <p style="margin:0 0 24px 0; font-size:15px; color:#444; line-height:1.6;">
                        Click the button below to accept the invite and set your password.
                      </p>

                      <p style="margin:0 0 32px 0;">
                        <a
                          href="${inviteUrl}"
                          style="display:inline-block; background:#273097; color:#fff; text-decoration:none; padding:14px 24px; border-radius:10px; font-weight:bold;"
                        >
                          Accept invite
                        </a>
                      </p>

                      <p style="margin:0; font-size:13px; color:#777; line-height:1.6;">
                        If the button does not work, use this link:
                        <br />
                        <a href="${inviteUrl}" style="color:#273097;">${inviteUrl}</a>
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:24px 40px; background:#fafafa; font-size:12px; color:#888;">
                      This is an automated email from Otman Transport.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };
}