import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { extractYoutubeVideoId } from "@/lib/docArchive/youtubeUtil";

export const MAX_YOUTUBE_URL_LENGTH = 2000;
export const MAX_YOUTUBE_TITLE_LENGTH = 200;

export type YoutubeEmbedData = { url: string; title: string | null };

// Provisioned lazily on first read, same idea as titles.ts's
// getOrCreateTitle — a YOUTUBE section always exists once its picker tile is
// clicked (createContentSection), but its url/title are only materialized
// the first time someone opens it.
//
// The find-then-create isn't atomic, and two GET requests for a freshly-added
// section can genuinely race (see getOrCreateTitle's comment for why). The
// loser's create hits ArchiveItemYoutubeEmbed's `sectionId` unique
// constraint (P2002) — recovered by just re-reading the row the winner
// created.
export async function getOrCreateYoutubeEmbed(
  companyId: string,
  tenantId: string,
  itemId: string,
  sectionId: string,
): Promise<YoutubeEmbedData> {
  const existing = await prisma.archiveItemYoutubeEmbed.findFirst({
    where: { sectionId, companyId, tenantId },
    select: { url: true, title: true },
  });
  if (existing) return existing;

  try {
    await prisma.archiveItemYoutubeEmbed.create({
      data: { companyId, tenantId, itemId, sectionId, url: "" },
    });
    return { url: "", title: null };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.archiveItemYoutubeEmbed.findFirst({
        where: { sectionId, companyId, tenantId },
        select: { url: true, title: true },
      });
      if (winner) return winner;
    }
    throw error;
  }
}

export type UpdateYoutubeEmbedResult = { ok: true } | { ok: false; reason: "INVALID_DATA" };

// An empty url is accepted (clearing the embed back to "nothing pasted
// yet"), same as titles.ts allowing an empty heading — everything else must
// parse to a real YouTube video id via extractYoutubeVideoId, matching the
// exact same rule the settings panel already validated against client-side.
// title is optional (a bare caption, not rich text — see the schema
// comment) — an empty/omitted title clears back to null.
export async function updateYoutubeEmbed(
  companyId: string,
  tenantId: string,
  itemId: string,
  sectionId: string,
  url: unknown,
  title: unknown,
): Promise<UpdateYoutubeEmbedResult> {
  if (typeof url !== "string" || url.length > MAX_YOUTUBE_URL_LENGTH) return { ok: false, reason: "INVALID_DATA" };
  if (title !== undefined && title !== null && typeof title !== "string") return { ok: false, reason: "INVALID_DATA" };
  if (typeof title === "string" && title.length > MAX_YOUTUBE_TITLE_LENGTH) return { ok: false, reason: "INVALID_DATA" };

  const trimmedUrl = url.trim();
  if (trimmedUrl && !extractYoutubeVideoId(trimmedUrl)) return { ok: false, reason: "INVALID_DATA" };

  const trimmedTitle = typeof title === "string" ? title.trim() : "";

  await prisma.archiveItemYoutubeEmbed.upsert({
    where: { sectionId },
    create: { companyId, tenantId, itemId, sectionId, url: trimmedUrl, title: trimmedTitle || null },
    update: { url: trimmedUrl, title: trimmedTitle || null },
  });

  return { ok: true };
}
