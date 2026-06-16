import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/sendEmail";
import { checkRateLimit, incrementRateLimit } from "@/lib/auth/rateLimit";
import { TjenesterContent } from "@/lib/content/TjenesterContent";

const MANPOWER_IP_LIMIT = 5;
const MANPOWER_WINDOW_MS = 10 * 60 * 1000;

// Module-level global rate limit — 1 per minute, 20 per day
const _rl = { lastAt: 0, dayStr: "", dayCount: 0 };

function checkGlobalRateLimit(): "ok" | "minute" | "daily" {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (_rl.dayStr !== today) { _rl.dayStr = today; _rl.dayCount = 0; }
  if (now - _rl.lastAt < 60_000) return "minute";
  if (_rl.dayCount >= 20) return "daily";
  _rl.lastAt = now;
  _rl.dayCount++;
  return "ok";
}

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
const LETTERS_NUMBERS_RE = /^[\p{L}\p{N}\s]+$/u;

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
  const rl = checkGlobalRateLimit();
  if (rl === "minute") return NextResponse.json({ ok: false, reason: "RATE_LIMIT_MINUTE" }, { status: 429 });
  if (rl === "daily")  return NextResponse.json({ ok: false, reason: "RATE_LIMIT_DAILY" },  { status: 429 });

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
  const customServiceTrimmed = typeof raw.customService === "string" ? raw.customService.trim() : "";
  const descriptionTrimmed = typeof raw.description === "string" ? raw.description.trim() : "";

  if (!nameTrimmed || nameTrimmed.length < 2 || nameTrimmed.length > 80 || !NAME_REGEX.test(nameTrimmed)) {
    return badRequest("Invalid name");
  }
  if (!contactTrimmed || contactTrimmed.length < 5 || contactTrimmed.length > 254) {
    return badRequest("Invalid contact");
  }
  if (!jobTypeTrimmed) {
    return badRequest("Invalid job type");
  }
  if (jobTypeTrimmed === "custom" && (!customServiceTrimmed || customServiceTrimmed.length > 200 || !LETTERS_NUMBERS_RE.test(customServiceTrimmed))) {
    return badRequest("Invalid custom service");
  }
  if (!descriptionTrimmed || descriptionTrimmed.length < 10 || descriptionTrimmed.length > 1000 || !LETTERS_NUMBERS_RE.test(descriptionTrimmed)) {
    return badRequest("Invalid description");
  }

  if (ip) {
    await incrementRateLimit({ key: `manpower:ip:${ip}`, windowMs: MANPOWER_WINDOW_MS });
  }

  try {
    const jobTypeOption = TjenesterContent.jobTypeOptions.find((o) => o.value === jobTypeTrimmed);
    const jobTypeLabel = jobTypeTrimmed === "custom"
      ? `${jobTypeOption?.label.no ?? "Egendefinert tjeneste"} — ${escapeHtml(customServiceTrimmed)}`
      : escapeHtml(jobTypeOption?.label.no ?? jobTypeTrimmed);

    await sendEmail({
      to: { email: "bestilling@otman.no", name: "Otman AS" },
      subject: `Website tjenester inquiry: ${escapeHtml(nameTrimmed)}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
          <p><strong>Name:</strong> ${escapeHtml(nameTrimmed)}</p>
          <p><strong>Contact:</strong> ${escapeHtml(contactTrimmed)}</p>
          <p><strong>Service type:</strong> ${jobTypeLabel}</p>
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
