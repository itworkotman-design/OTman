// pg (pg-connection-string v2) treats sslmode=require / prefer / verify-ca as
// verify-full and logs a SECURITY WARNING on every new connection saying so
// (it changes in pg v9). The pools (lib/db.ts, lib/docArchive/client.ts) get
// that mode spelled out — the same behaviour, no warning. The env URL itself
// stays as is: `prisma migrate` (scripts/vercel-build.sh) reads it too.
export function pgConnectionString(url: string | undefined): string | undefined {
  if (!url || /[?&]uselibpqcompat=true\b/.test(url)) return url;
  return url.replace(/([?&]sslmode=)(require|prefer|verify-ca)\b/, "$1verify-full");
}

// The pool options both Prisma clients use (lib/db.ts, lib/docArchive/client.ts).
// Neon closes idle connections, and a serverless function frozen between
// requests can wake up holding a socket that is already dead — without
// timeouts a query on it waits forever (seen as the website catalog hanging
// on "Laster…"). With them it fails fast and the pool opens a fresh one.
export function pgPoolOptions(url: string | undefined) {
  return {
    connectionString: pgConnectionString(url),
    ssl: { rejectUnauthorized: false },
    // Opening a connection (incl. waking a suspended Neon compute).
    connectionTimeoutMillis: 10_000,
    // A query that gets no answer — e.g. sent on a dead socket.
    query_timeout: 25_000,
    // Close idle connections ourselves, well before Neon drops them.
    idleTimeoutMillis: 30_000,
    keepAlive: true,
  };
}
