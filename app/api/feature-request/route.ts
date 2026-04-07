import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/sendEmail";
import { getAuthenticatedSession } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const session = await getAuthenticatedSession(req);
    const body = await req.json();

    const { type, details } = body ?? {};

    if (!type || !details) {
      return NextResponse.json(
        { ok: false, reason: "Missing fields" },
        { status: 400 },
      );
    }

    const userEmail = session?.email ?? "unknown";
    const safeDetails = String(details).replace(/\n/g, "<br />");

    await sendEmail({
      to: { email: "itworkotman@gmail.com" },
      subject: `Feature request: ${type} by ${userEmail}`,
      html: `
        <div>
          <p><strong>From:</strong> ${userEmail}</p>
          <p><strong>Type:</strong> ${type}</p>
          <p><strong>Details:</strong></p>
          <p>${safeDetails}</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Feature request error:", err);
    return NextResponse.json(
      { ok: false, reason: "Failed to send request" },
      { status: 500 },
    );
  }
}
