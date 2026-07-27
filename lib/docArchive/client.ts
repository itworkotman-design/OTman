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
const archivePrisma = createArchivePrismaClient({ adapter: driverAdapter });

export const archive: ArchiveHostAdapter =
  globalForArchive.archiveHostAdapter ??
  createArchiveHostAdapter(archivePrisma, {
    fileStorageProvider: archiveS3StorageProvider,
    fileContentPolicy: { maxUploadSizeBytes: 10 * 1024 * 1024 },
    conditionThresholds: {
      dueSoonMs: 72 * 60 * 60 * 1000,
      expiringSoonMs: 72 * 60 * 60 * 1000,
    },
    searchPolicy: { defaultLimit: 20, maxLimit: 100 },
    retentionPolicy: { deletedFileRetentionMs: 30 * 24 * 60 * 60 * 1000 },
  });

if (process.env.NODE_ENV !== "production") {
  globalForArchive.archiveHostAdapter = archive;
}
