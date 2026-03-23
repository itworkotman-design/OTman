import { registerInviteDeliveryAdapter } from "@/lib/auth/inviteDelivery";
import { sendEmail } from "@/lib/email/sendEmail";
import { buildInviteEmail } from "@/lib/email/buildInviteEmail";

let registered = false;

export function ensureInviteDeliveryRegistered() {
  if (registered) return;

  registerInviteDeliveryAdapter(async ({ email, inviteUrl }) => {
    const emailContent = buildInviteEmail({
      inviteUrl,
      companyName: "Otman Transport",
      role: "USER",
      recipientEmail: email,
    });

    await sendEmail({
      to: { email },
      subject: emailContent.subject,
      html: emailContent.html,
    });
  });

  registered = true;
}