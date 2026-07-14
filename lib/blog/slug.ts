import { prisma } from "@/lib/db";

export function slugifyText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

export async function generateUniqueBlogSlug(
  baseText: string,
  excludePostId?: string,
): Promise<string> {
  const base = slugifyText(baseText) || "post";
  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = await prisma.blogPost.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludePostId) {
      return candidate;
    }

    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

export async function generateUniqueBlogTagSlug(baseText: string): Promise<string> {
  const base = slugifyText(baseText) || "tag";
  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = await prisma.blogTag.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}
