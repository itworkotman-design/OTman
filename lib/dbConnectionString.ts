// pg (pg-connection-string v2) treats sslmode=require / prefer / verify-ca as
// verify-full and logs a SECURITY WARNING on every new connection saying so
// (it changes in pg v9). The pools (lib/db.ts, lib/docArchive/client.ts) get
// that mode spelled out — the same behaviour, no warning. The env URL itself
// stays as is: `prisma migrate` (scripts/vercel-build.sh) reads it too.
export function pgConnectionString(url: string | undefined): string | undefined {
  if (!url || /[?&]uselibpqcompat=true\b/.test(url)) return url;
  return url.replace(/([?&]sslmode=)(require|prefer|verify-ca)\b/, "$1verify-full");
}
