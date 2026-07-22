import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, incrementRateLimit } from "@/lib/auth/rateLimit";
import { REVIEW_COOKIE, REVIEW_COOKIE_MAX_AGE, COMMENT_MAX_LENGTH, hasUnsafeChars } from "@/lib/reviews";

const REVIEW_IP_LIMIT = 5;
const REVIEW_WINDOW_MS = REVIEW_COOKIE_MAX_AGE * 1000; // 7 days

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

function isProd() {
  return process.env.NODE_ENV === "production";
}

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  if (cookieHeader.split(";").some((part) => part.trim().startsWith(`${REVIEW_COOKIE}=`))) {
    return NextResponse.json({ ok: false, reason: "Already submitted" }, { status: 409 });
  }

  const ip = getClientIp(req);

  if (ip) {
    const ipKey = `review:ip:${ip}`;
    const check = await checkRateLimit({ key: ipKey, limit: REVIEW_IP_LIMIT });
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

  const rating = typeof raw.rating === "number" ? raw.rating : Number(raw.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return badRequest("Invalid rating");
  }

  const commentTrimmed = typeof raw.comment === "string" ? raw.comment.trim() : "";
  if (commentTrimmed.length > COMMENT_MAX_LENGTH) {
    return badRequest(`Comment must be ${COMMENT_MAX_LENGTH} characters or less.`);
  }
  if (hasUnsafeChars(commentTrimmed)) {
    return badRequest("Comment contains characters that are not allowed.");
  }

  if (ip) {
    await incrementRateLimit({ key: `review:ip:${ip}`, windowMs: REVIEW_WINDOW_MS });
  }

  try {
    await prisma.review.create({
      data: {
        rating,
        comment: commentTrimmed || null,
      },
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: REVIEW_COOKIE,
      value: "1",
      httpOnly: true,
      sameSite: "lax",
      secure: isProd(),
      path: "/",
      maxAge: REVIEW_COOKIE_MAX_AGE,
    });
    return res;
  } catch (err) {
    console.error("Review submit failed:", err);
    return NextResponse.json({ ok: false, reason: "Failed to save" }, { status: 500 });
  }
}
