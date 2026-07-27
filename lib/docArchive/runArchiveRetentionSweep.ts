import type { ArchiveContextInput } from "@customprojects/custom-archive";
import { prisma } from "@/lib/db";
import { archive, archivePrisma, ARCHIVE_DELETED_FILE_RETENTION_MS } from "@/lib/docArchive/client";

export type ArchiveRetentionSweepSummary = {
  companiesProcessed: number;
  companiesSkippedNoActor: number;
  purged: number;
  purgeSkipped: number;
  purgeFailed: number;
  reconcileProcessed: number;
  reconcileOutcomes: Record<string, number>;
};

// Bounded per-company pass, same shape as `reconcileStorageOperations`'s own
// `take` — this is not the *only* cap (see `purgeLimit` below), just the
// per-call ceiling on how many storage-operation rows one company's sweep
// touches per cron invocation.
const RECONCILE_TAKE_PER_COMPANY = 200;

// `archivePrisma` is typed as `ArchivePrismaClient` (= `PrismaArchiveHostAdapterClient`),
// a deliberately narrow internal contract exposing only the exact delegate
// shapes the package's OWN services use — not a general-purpose query client
// for host code. At runtime it's still a real, full generated PrismaClient
// (`createArchivePrismaClient` just calls `new PrismaClient(options)` — see
// node_modules/@customprojects/custom-archive/dist/archive/prisma/prisma-client.js),
// so `archiveFile.findMany` genuinely exists and works; only the TS type
// hides it. There's no sanctioned way around this: `purgeFile` has no
// batch/list-candidates surface of its own (API.md: "single-target only, no
// batch/scheduler surface"), and the package's export map only exposes its
// root entrypoint, not its generated Prisma client module, so the real full
// client type can't be imported either. This minimal local type is scoped to
// exactly the one query this sweep needs.
type ArchiveFilePurgeCandidateQueryClient = {
  archiveFile: {
    findMany(args: {
      where: { companyId: string; deletedAt: { lte: Date }; purgedAt: null };
      select: { id: true };
      orderBy: { deletedAt: "asc" };
      take?: number;
    }): Promise<{ id: string }[]>;
  };
};

function toErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

// Shared by the cron route so a caller can bound how many purge candidates
// each company's sweep processes per call, same convention as
// parseGdprLimitParam/parsePaymentTimeoutLimitParam.
export function parseArchiveRetentionLimitParam(searchParams: URLSearchParams): number | undefined {
  const raw = searchParams.get("limit");
  if (!raw) return undefined;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

// `purgeFile`/`reconcileStorageOperations` are host-adapter "system"
// operations (API.md "System operations": no Archive caller-permission
// check — the host must restrict them and must reference an existing,
// active company member). There's no interactive user triggering a cron
// run, so each company's sweep is attributed to one of its own active
// members — preferring OWNER, then ADMIN, then whoever's first — purely so
// the referenced userId is a real, valid, active member of that company.
// This carries no special privilege here since neither method checks
// permissions at all.
async function pickActorUserId(companyId: string): Promise<string | null> {
  const memberships = await prisma.membership.findMany({
    where: { companyId, status: "ACTIVE" },
    select: { userId: true, role: true },
  });

  if (memberships.length === 0) return null;

  return (
    memberships.find((m) => m.role === "OWNER")?.userId ??
    memberships.find((m) => m.role === "ADMIN")?.userId ??
    memberships[0].userId
  );
}

// Runs, per active company: one bounded `reconcileStorageOperations` pass
// (clears interrupted uploads/deletes so a stuck row doesn't shadow a real
// purge candidate), then `purgeFile` for every soft-deleted file past the
// configured retention window that hasn't been purged yet. There is no
// bulk/batch purge method on the host adapter (API.md: "single-target only,
// no batch/scheduler surface"), so purge candidates are discovered by
// querying `archive_files` directly via the exported `archivePrisma` client
// and purged one at a time.
export async function runArchiveRetentionSweep(
  options: { purgeLimit?: number } = {},
): Promise<ArchiveRetentionSweepSummary> {
  const summary: ArchiveRetentionSweepSummary = {
    companiesProcessed: 0,
    companiesSkippedNoActor: 0,
    purged: 0,
    purgeSkipped: 0,
    purgeFailed: 0,
    reconcileProcessed: 0,
    reconcileOutcomes: {},
  };

  const companies = await prisma.company.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  const purgeCutoff = new Date(Date.now() - ARCHIVE_DELETED_FILE_RETENTION_MS);

  for (const company of companies) {
    const actorUserId = await pickActorUserId(company.id);

    if (!actorUserId) {
      summary.companiesSkippedNoActor += 1;
      continue;
    }

    const ctx: ArchiveContextInput = {
      userId: actorUserId,
      companyId: company.id,
      tenantId: company.id,
      archiveModuleAccess: true,
    };

    const reconcileResult = await archive.reconcileStorageOperations(ctx, {
      take: RECONCILE_TAKE_PER_COMPANY,
    });

    if (reconcileResult.ok) {
      summary.reconcileProcessed += reconcileResult.value.processedCount;
      for (const [key, value] of Object.entries(reconcileResult.value)) {
        summary.reconcileOutcomes[key] = (summary.reconcileOutcomes[key] ?? 0) + value;
      }
    } else {
      console.error(
        `[archive-retention] reconcileStorageOperations failed for company ${company.id}:`,
        reconcileResult.error.message,
      );
    }

    const purgeCandidates = await (archivePrisma as unknown as ArchiveFilePurgeCandidateQueryClient).archiveFile.findMany({
      where: {
        companyId: company.id,
        // A `lte` comparison against `deletedAt` already excludes NULL rows
        // (SQL NULL comparisons are never true), so this doubles as the
        // "is soft-deleted" check without a separate `not: null`.
        deletedAt: { lte: purgeCutoff },
        purgedAt: null,
      },
      select: { id: true },
      orderBy: { deletedAt: "asc" },
      ...(options.purgeLimit ? { take: options.purgeLimit } : {}),
    });

    for (const file of purgeCandidates) {
      const purgeResult = await archive.purgeFile(ctx, { fileId: file.id });

      if (purgeResult.ok) {
        summary.purged += 1;
      } else if (purgeResult.error.category === "validation") {
        // Re-evaluated fresh at call time (e.g. restored between our
        // candidate query and this call) — a controlled, expected skip.
        summary.purgeSkipped += 1;
      } else {
        summary.purgeFailed += 1;
        console.error(
          `[archive-retention] purgeFile failed for file ${file.id}:`,
          toErrorMessage(purgeResult.error.message),
        );
      }
    }

    summary.companiesProcessed += 1;
  }

  return summary;
}
