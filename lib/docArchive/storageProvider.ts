import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { ArchiveFileStorageProvider } from "@customprojects/custom-archive";

type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

const ARCHIVE_KEY_PREFIX = "archive/";

let cachedS3Client: S3Client | null = null;
let cachedConfigKey: string | null = null;

function getRequiredS3Config(): S3Config {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing S3 storage environment variables: S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY",
    );
  }

  return { bucket, region, accessKeyId, secretAccessKey };
}

function getS3Client(config: S3Config): S3Client {
  const configKey = [
    config.bucket,
    config.region,
    config.accessKeyId,
    config.secretAccessKey,
  ].join(":");

  if (!cachedS3Client || cachedConfigKey !== configKey) {
    cachedS3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    cachedConfigKey = configKey;
  }

  return cachedS3Client;
}

function hasTransformToByteArray(
  value: unknown,
): value is { transformToByteArray: () => Promise<Uint8Array> } {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as { transformToByteArray?: unknown };
  return typeof candidate.transformToByteArray === "function";
}

export const archiveS3StorageProvider: ArchiveFileStorageProvider = {
  providerId: "s3",

  async write({ storageKey, content }) {
    const config = getRequiredS3Config();
    const client = getS3Client(config);

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: `${ARCHIVE_KEY_PREFIX}${storageKey}`,
        Body: content,
      }),
    );
  },

  async read(storageKey) {
    const config = getRequiredS3Config();
    const client = getS3Client(config);

    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: `${ARCHIVE_KEY_PREFIX}${storageKey}`,
        }),
      );

      if (!hasTransformToByteArray(response.Body)) {
        return null;
      }

      return await response.Body.transformToByteArray();
    } catch (error) {
      if (error instanceof NoSuchKey) {
        return null;
      }
      throw error;
    }
  },

  async delete(storageKey) {
    const config = getRequiredS3Config();
    const client = getS3Client(config);

    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: `${ARCHIVE_KEY_PREFIX}${storageKey}`,
      }),
    );
  },
};
