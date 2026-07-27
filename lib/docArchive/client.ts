import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "pg";
import {
  createArchiveHostAdapter,
  createArchivePrismaClient,
  type ArchiveHostAdapter,
} from "@customprojects/custom-archive";
import { archiveS3StorageProvider } from "@/lib/docArchive/storageProvider";

const { Pool } = pkg;

const globalForArchive = globalThis as unknown as {
  archiveHostAdapter?: ArchiveHostAdapter;
};

if (!process.env.ARCHIVE_DATABASE_URL) {
  throw new Error("ARCHIVE_DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString: process.env.ARCHIVE_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const driverAdapter = new PrismaPg(pool, { schema: "archive" });

// Exported (not just module-private) so the retention/reconciliation cron
// (lib/docArchive/runArchiveRetentionSweep.ts) can query archive_files
// directly for purge candidates — the host adapter has no bulk "list files
// past retention across the tenant" method, only a single-target `purgeFile`.
export const archivePrisma = createArchivePrismaClient({ adapter: driverAdapter });

// Archive's uploadFile takes the whole file as an in-memory Uint8Array (no
// chunked/streaming upload in the package), so this is also the ceiling on
// how much a single upload request buffers in the Node process.
export const ARCHIVE_MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024;

// Kept as a named constant (not just inlined below) so the retention cron can
// pre-filter purge candidates by the same window `purgeFile` itself enforces,
// instead of calling it speculatively on every soft-deleted file.
export const ARCHIVE_DELETED_FILE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const archive: ArchiveHostAdapter =
  globalForArchive.archiveHostAdapter ??
  createArchiveHostAdapter(archivePrisma, {
    fileStorageProvider: archiveS3StorageProvider,
    fileContentPolicy: { maxUploadSizeBytes: ARCHIVE_MAX_UPLOAD_SIZE_BYTES },
    conditionThresholds: {
      dueSoonMs: 72 * 60 * 60 * 1000,
      expiringSoonMs: 72 * 60 * 60 * 1000,
    },
    searchPolicy: { defaultLimit: 20, maxLimit: 100 },
    retentionPolicy: { deletedFileRetentionMs: ARCHIVE_DELETED_FILE_RETENTION_MS },
  });

if (process.env.NODE_ENV !== "production") {
  globalForArchive.archiveHostAdapter = archive;
}
