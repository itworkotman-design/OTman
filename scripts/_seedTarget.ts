// Which database a seed script is about to write to, decided from DATABASE_URL.
// Used to make the local seed scripts refuse anything but localhost and the
// production seed scripts refuse localhost — see _loadLocalSeedEnv.ts and
// _loadProductionSeedEnv.ts. Only ever exposes host + database name, never the
// credentials.

export type DbTarget = { host: string; database: string; isLocal: boolean };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function describeDatabaseUrl(url: string | undefined): DbTarget {
  if (!url || !url.trim()) {
    throw new Error("DATABASE_URL is not set");
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("DATABASE_URL is not a valid connection URL");
  }

  // URL keeps the brackets of an IPv6 host ("[::1]").
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  return {
    host,
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    isLocal: LOCAL_HOSTS.has(host),
  };
}

export function assertLocalTarget(target: DbTarget, scriptName: string): void {
  if (target.isLocal) return;

  throw new Error(
    `Refusing to run ${scriptName}: DATABASE_URL points at ${target.host}/${target.database}, which is not a local database. ` +
      `This script only seeds your LOCAL database — put your local DATABASE_URL in .env.local. ` +
      `To seed the production database from .env, use the matching "...:prod" npm script instead.`,
  );
}

export function assertProductionTarget(target: DbTarget): void {
  if (!target.isLocal) return;

  throw new Error(
    `Refusing to run a production seed: DATABASE_URL in .env points at a local database (${target.host}/${target.database}). ` +
      `Production seed scripts read ONLY .env and must point at the production database.`,
  );
}
