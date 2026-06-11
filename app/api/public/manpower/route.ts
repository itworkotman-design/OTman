import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/sendEmail";
import { checkRateLimit, incrementRateLimit } from "@/lib/auth/rateLimit";

const MANPOWER_IP_LIMIT = 5;
const MANPOWER_WINDOW_MS = 10 * 60 * 1000;

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;

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
    const check = await checkRateLimit({ key: `manpower:ip:${ip}`, limit: MANPOWER_IP_LIMIT });
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
  const contactTrimmed = typeof raw.contact === "string" ? raw.contact.trim() : "";
  const jobTypeTrimmed = typeof raw.jobType === "string" ? raw.jobType.trim() : "";
  const descriptionTrimmed = typeof raw.description === "string" ? raw.description.trim() : "";

  if (!nameTrimmed || nameTrimmed.length < 2 || nameTrimmed.length > 80 || !NAME_REGEX.test(nameTrimmed)) {
    return badRequest("Invalid name");
  }
  if (!contactTrimmed || contactTrimmed.length < 5 || contactTrimmed.length > 254) {
    return badRequest("Invalid contact");
  }
  if (!jobTypeTrimmed || jobTypeTrimmed.length < 2 || jobTypeTrimmed.length > 100) {
    return badRequest("Invalid job type");
  }
  if (!descriptionTrimmed || descriptionTrimmed.length < 10 || descriptionTrimmed.length > 1000) {
    return badRequest("Invalid description");
  }

  if (ip) {
    await incrementRateLimit({ key: `manpower:ip:${ip}`, windowMs: MANPOWER_WINDOW_MS });
  }

  try {
    await sendEmail({
      to: { email: "bestilling@otman.no", name: "Otman AS" },
      subject: `Manpower rental inquiry: ${escapeHtml(nameTrimmed)}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
          <p><strong>Name:</strong> ${escapeHtml(nameTrimmed)}</p>
          <p><strong>Contact:</strong> ${escapeHtml(contactTrimmed)}</p>
          <p><strong>Job type:</strong> ${escapeHtml(jobTypeTrimmed)}</p>
          <p><strong>Description:</strong></p>
          <p style="white-space:pre-wrap;">${escapeHtml(descriptionTrimmed)}</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Manpower form send failed:", err);
    return NextResponse.json({ ok: false, reason: "Failed to send" }, { status: 500 });
  }
}
