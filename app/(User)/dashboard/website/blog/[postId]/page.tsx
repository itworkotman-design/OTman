// app/(User)/dashboard/website/blog/[postId]/page.tsx
import BlogEditor from "@/app/_components/Dahsboard/website/BlogEditor";

export default async function BlogEditorPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  return <BlogEditor postId={postId} />;
}
