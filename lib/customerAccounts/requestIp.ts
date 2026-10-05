// The client IP for rate limiting (first x-forwarded-for hop, as
// app/api/auth/login does).
export function getClientIp(req: Request): string | null {
  const first = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || null;
}
