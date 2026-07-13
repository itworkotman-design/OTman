// app/(User)/dashboard/website/page.tsx
import { prisma } from "@/lib/db";
import WebsiteEditorDashboard from "@/app/_components/Dahsboard/website/WebsiteEditorDashboard";

export default async function WebsiteEditorPage() {
  const [total, published, draft, archived] = await Promise.all([
    prisma.blogPost.count(),
    prisma.blogPost.count({ where: { status: "PUBLISHED" } }),
    prisma.blogPost.count({ where: { status: "DRAFT" } }),
    prisma.blogPost.count({ where: { status: "ARCHIVED" } }),
  ]);

  return (
    <WebsiteEditorDashboard
      cards={[
        {
          title: "Blog",
          description: "Write and manage blog posts shown on the public website.",
          href: "/dashboard/website/blog",
          stats: [
            { label: "Total posts", value: total },
            { label: "Published", value: published },
            { label: "Drafts", value: draft },
            { label: "Archived", value: archived },
          ],
        },
      ]}
    />
  );
}
