export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: { email: string; name?: string };
  subject: string;
  html: string;
}) {
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
      to: [
        {
          email: to.email,
          name: to.name ?? to.email,
        },
      ],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Brevo send failed: ${errorText}`);
  }
}