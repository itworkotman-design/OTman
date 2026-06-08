import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/sendEmail";
import { checkRateLimit, incrementRateLimit } from "@/lib/auth/rateLimit";

const CONTACT_IP_LIMIT = 5;
const CONTACT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
const PHONE_REGEX = /^[0-9+()\-\s]+$/;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

function badRequest(reason: string) {
  return NextResponse.json({ ok: false, reason }, { status: 400 });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  if (ip) {
    const ipKey = `contact:ip:${ip}`;
    const check = await checkRateLimit({ key: ipKey, limit: CONTACT_IP_LIMIT });
    if (!check.allowed) {
      return NextResponse.json(
        { ok: false, reason: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (!body || typeof body !== "object") return badRequest("Invalid body");

  const raw = body as Record<string, unknown>;

  // Honeypot — bots fill this hidden field; real users never see it
  if (raw._hp !== "" && raw._hp !== undefined && raw._hp !== null) {
    return NextResponse.json({ ok: true });
  }

  const nameTrimmed = typeof raw.name === "string" ? raw.name.trim() : "";
  const emailTrimmed = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const phoneTrimmed = typeof raw.phone === "string" ? raw.phone.trim() : "";
  const messageTrimmed = typeof raw.message === "string" ? raw.message.trim() : "";

  if (!nameTrimmed || nameTrimmed.length < 2 || nameTrimmed.length > 80 || !NAME_REGEX.test(nameTrimmed)) {
    return badRequest("Invalid name");
  }
  if (!emailTrimmed || emailTrimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return badRequest("Invalid email");
  }
  if (phoneTrimmed && (phoneTrimmed.length < 7 || phoneTrimmed.length > 20 || !PHONE_REGEX.test(phoneTrimmed))) {
    return badRequest("Invalid phone");
  }
  if (!messageTrimmed || messageTrimmed.length < 10 || messageTrimmed.length > 1000) {
    return badRequest("Invalid message");
  }

  if (ip) {
    await incrementRateLimit({ key: `contact:ip:${ip}`, windowMs: CONTACT_WINDOW_MS });
  }

  const phoneRow = phoneTrimmed
    ? `<p><strong>Phone:</strong> ${escapeHtml(phoneTrimmed)}</p>`
    : "";

  try {
    await sendEmail({
      to: { email: "otman@otman.no", name: "Otman AS" },
      replyTo: { email: emailTrimmed, name: nameTrimmed },
      subject: `Contact form: ${escapeHtml(nameTrimmed)}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
          <p><strong>Name:</strong> ${escapeHtml(nameTrimmed)}</p>
          <p><strong>Email:</strong> ${escapeHtml(emailTrimmed)}</p>
          ${phoneRow}
          <p><strong>Message:</strong></p>
          <p style="white-space:pre-wrap;">${escapeHtml(messageTrimmed)}</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact form send failed:", err);
    return NextResponse.json({ ok: false, reason: "Failed to send" }, { status: 500 });
  }
}
