import type { Prisma } from "@prisma/client";

// Position shifts must never collide mid-transaction against the
// @@unique([blogPostId, position]) constraint (a non-deferrable unique
// index), so every reposition goes through a large, out-of-range temporary
// offset first before landing on final sequential values.
const TEMP_OFFSET = 1_000_000;

export async function applySectionPositions(
  tx: Prisma.TransactionClient,
  orderedSectionIds: string[],
): Promise<void> {
  await Promise.all(
    orderedSectionIds.map((id, index) =>
      tx.blogSection.update({ where: { id }, data: { position: TEMP_OFFSET + index } }),
    ),
  );

  await Promise.all(
    orderedSectionIds.map((id, index) =>
      tx.blogSection.update({ where: { id }, data: { position: index } }),
    ),
  );
}
