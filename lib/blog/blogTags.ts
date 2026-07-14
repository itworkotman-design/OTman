import { prisma } from "@/lib/db";
import { generateUniqueBlogTagSlug } from "@/lib/blog/slug";

async function findOrCreateTagByName(name: string) {
  const existing = await prisma.blogTag.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing;

  const slug = await generateUniqueBlogTagSlug(name);
  return prisma.blogTag.create({ data: { name, slug } });
}

// Replaces the full set of tags on a post — the editor always sends the
// complete desired tag list, so a full delete+recreate of the join rows is
// simpler and less error-prone than diffing additions/removals.
export async function setPostTags(blogPostId: string, tagNames: string[]): Promise<void> {
  const uniqueNames = Array.from(
    new Map(tagNames.map((name) => [name.trim().toLowerCase(), name.trim()])).values(),
  ).filter(Boolean);

  const tags = await Promise.all(uniqueNames.map((name) => findOrCreateTagByName(name)));

  await prisma.$transaction([
    prisma.blogPostTag.deleteMany({ where: { blogPostId } }),
    ...(tags.length > 0
      ? [
          prisma.blogPostTag.createMany({
            data: tags.map((tag) => ({ blogPostId, blogTagId: tag.id })),
          }),
        ]
      : []),
  ]);
}

export async function listAllBlogTags(): Promise<
  { id: string; name: string; slug: string; postCount: number }[]
> {
  const tags = await prisma.blogTag.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, _count: { select: { posts: true } } },
  });

  return tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug, postCount: tag._count.posts }));
}

// Reassigns every post tagged with `sourceTagId` over to `targetTagId`
// (skipping posts already tagged with the target, since the join table's
// composite key would otherwise collide) and deletes the now-empty source
// tag — the fix for near-duplicate tags like "Car" vs "Cars".
export async function mergeBlogTags(sourceTagId: string, targetTagId: string): Promise<void> {
  const sourcePostTags = await prisma.blogPostTag.findMany({ where: { blogTagId: sourceTagId } });

  await prisma.$transaction(async (tx) => {
    for (const postTag of sourcePostTags) {
      await tx.blogPostTag.upsert({
        where: { blogPostId_blogTagId: { blogPostId: postTag.blogPostId, blogTagId: targetTagId } },
        create: { blogPostId: postTag.blogPostId, blogTagId: targetTagId },
        update: {},
      });
    }
    await tx.blogPostTag.deleteMany({ where: { blogTagId: sourceTagId } });
    await tx.blogTag.delete({ where: { id: sourceTagId } });
  });
}
