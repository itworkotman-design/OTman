import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/sendEmail";
import { checkRateLimit, incrementRateLimit } from "@/lib/auth/rateLimit";

const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escape(v: string) {
  return v
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

function bad(reason: string) {
  return NextResponse.json({ ok: false, reason }, { status: 400 });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  if (ip) {
    const check = await checkRateLimit({ key: `vehicle-booking:ip:${ip}`, limit: LIMIT });
    if (!check.allowed) {
      return NextResponse.json({ ok: false, reason: "Too many requests." }, { status: 429 });
    }
  }

  let body: unknown;
  try { body = await req.json(); } catch { return bad("Invalid JSON"); }
  if (!body || typeof body !== "object") return bad("Invalid body");

  const raw = body as Record<string, unknown>;

  if (raw._hp !== "" && raw._hp !== undefined && raw._hp !== null) {
    return NextResponse.json({ ok: true });
  }

  const vehicleName = typeof raw.vehicleName === "string" ? raw.vehicleName.trim() : "";
  const bookingType = raw.bookingType;
  const firstName = typeof raw.firstName === "string" ? raw.firstName.trim() : "";
  const lastName = typeof raw.lastName === "string" ? raw.lastName.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";

  if (!vehicleName || vehicleName.length > 200) return bad("Invalid vehicle name");
  if (bookingType !== "rent" && bookingType !== "buy") return bad("Invalid booking type");
  if (!firstName || firstName.length < 2 || firstName.length > 80 || !NAME_REGEX.test(firstName)) return bad("Invalid first name");
  if (!lastName || lastName.length < 2 || lastName.length > 80 || !NAME_REGEX.test(lastName)) return bad("Invalid last name");
  if (!email || !EMAIL_REGEX.test(email) || email.length > 254) return bad("Invalid email");
  if (!phone || phone.length < 5 || phone.length > 30) return bad("Invalid phone");
  if (description.length > 1000) return bad("Description too long");

  let dateSection = "";
  if (bookingType === "rent") {
    const fromDate = typeof raw.fromDate === "string" ? raw.fromDate.trim() : "";
    const fromTime = typeof raw.fromTime === "string" ? raw.fromTime.trim() : "";
    const toDate = typeof raw.toDate === "string" ? raw.toDate.trim() : "";
    const toTime = typeof raw.toTime === "string" ? raw.toTime.trim() : "";
    if (!fromDate || !fromTime || !toDate || !toTime) return bad("Missing rental dates");
    dateSection = `
      <p><strong>From:</strong> ${escape(fromDate)} at ${escape(fromTime)}</p>
      <p><strong>To:</strong> ${escape(toDate)} at ${escape(toTime)}</p>
    `;
  }

  if (ip) {
    await incrementRateLimit({ key: `vehicle-booking:ip:${ip}`, windowMs: WINDOW_MS });
  }

  try {
    await sendEmail({
      to: { email: "bestilling@otman.no", name: "Otman AS" },
      subject: `${bookingType === "rent" ? "Bil leie forespørsel" : "Bil kjøp forespørsel"}: ${escape(vehicleName)}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;">
          <p><strong>Vehicle:</strong> ${escape(vehicleName)}</p>
          <p><strong>Type:</strong> ${bookingType === "rent" ? "Rental" : "Purchase"}</p>
          ${dateSection}
          <p><strong>Name:</strong> ${escape(firstName)} ${escape(lastName)}</p>
          <p><strong>Email:</strong> ${escape(email)}</p>
          <p><strong>Phone:</strong> ${escape(phone)}</p>
          ${description ? `<p><strong>Description:</strong></p><p style="white-space:pre-wrap;">${escape(description)}</p>` : ""}
        </div>
      `,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Vehicle booking send failed:", err);
    return NextResponse.json({ ok: false, reason: "Failed to send" }, { status: 500 });
  }
}
