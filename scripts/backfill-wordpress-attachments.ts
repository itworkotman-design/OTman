import "dotenv/config";
import { prisma } from "../lib/db";
import { normalizeAttachmentCategory } from "../lib/orders/attachmentCategories";
import { upsertWordpressOrderAttachment } from "../lib/orders/wordpressAttachmentStorage";

const WORDPRESS_UPLOAD_PREFIX = "https://otman.no/wp-content/uploads";

async function main() {
  const attachments = await prisma.orderAttachment.findMany({
    where: {
      source: "wordpress_import",
      legacyWordpressAttachmentId: {
        not: null,
      },
      OR: [
        {
          storagePath: {
            startsWith: WORDPRESS_UPLOAD_PREFIX,
          },
        },
        {
          sourceUrl: {
            startsWith: WORDPRESS_UPLOAD_PREFIX,
          },
        },
      ],
    },
    select: {
      orderId: true,
      legacyWordpressAttachmentId: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      storagePath: true,
      sourceUrl: true,
      category: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  let copied = 0;
  let failed = 0;

  for (const attachment of attachments) {
    if (attachment.legacyWordpressAttachmentId === null) continue;

    const sourceUrl = attachment.sourceUrl || attachment.storagePath;

    try {
      await upsertWordpressOrderAttachment({
        orderId: attachment.orderId,
        attachment: {
          legacyWordpressAttachmentId: attachment.legacyWordpressAttachmentId,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          sourceUrl,
          category: normalizeAttachmentCategory(attachment.category),
        },
      });
      copied += 1;
    } catch (error) {
      failed += 1;
      console.error("Backfill failed for WordPress attachment", {
        orderId: attachment.orderId,
        legacyWordpressAttachmentId: attachment.legacyWordpressAttachmentId,
        sourceUrl,
        error,
      });
    }
  }

  console.log("WordPress attachment backfill complete", {
    total: attachments.length,
    copied,
    failed,
  });
}

main()
  .catch((error) => {
    console.error("WordPress attachment backfill crashed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
