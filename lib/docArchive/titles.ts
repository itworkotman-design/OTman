import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sanitizeBlogHtml } from "@/lib/blog/sanitizeRichText";

// Host-side "title" item content, alongside the archive package's own file
// storage — same reasoning as spreadsheets.ts: the package has no
// structured-content storage (see
// docs/documentation/integrations/archive-ui-known-gaps.md). A single
// rich-text heading (bold/italic/color/alignment via
// TitleRichTextEditorField, same sanitizeBlogHtml pass as
// ArchiveItemTextField.value), capped generously above a plain label length
// to leave room for the formatting markup.
export const MAX_TITLE_LENGTH = 2000;

// Provisioned lazily on first read, same idea as
// spreadsheets.ts's getOrCreateSpreadsheet — a TITLE section always exists
// once its picker tile is clicked (createContentSection), but its text is
// only materialized the first time someone opens it.
//
// The find-then-create isn't atomic, and two GET requests for a freshly-added
// section can genuinely race (see getOrCreateSpreadsheet's comment for why).
// The loser's create hits ArchiveItemTitle's `sectionId` unique constraint
// (P2002) — recovered by just re-reading the row the winner created.
export async function getOrCreateTitle(
  companyId: string,
  tenantId: string,
  itemId: string,
  sectionId: string,
): Promise<string> {
  const existing = await prisma.archiveItemTitle.findFirst({
    where: { sectionId, companyId, tenantId },
    select: { text: true },
  });
  if (existing) return existing.text;

  try {
    await prisma.archiveItemTitle.create({
      data: { companyId, tenantId, itemId, sectionId, text: "" },
    });
    return "";
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.archiveItemTitle.findFirst({
        where: { sectionId, companyId, tenantId },
        select: { text: true },
      });
      if (winner) return winner.text;
    }
    throw error;
  }
}

export type UpdateTitleResult = { ok: true } | { ok: false; reason: "INVALID_DATA" };

export async function updateTitle(
  companyId: string,
  tenantId: string,
  itemId: string,
  sectionId: string,
  text: unknown,
): Promise<UpdateTitleResult> {
  if (typeof text !== "string" || text.length > MAX_TITLE_LENGTH) return { ok: false, reason: "INVALID_DATA" };

  const sanitized = sanitizeBlogHtml(text);

  await prisma.archiveItemTitle.upsert({
    where: { sectionId },
    create: { companyId, tenantId, itemId, sectionId, text: sanitized },
    update: { text: sanitized },
  });

  return { ok: true };
}
