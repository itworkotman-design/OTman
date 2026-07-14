import { NextResponse } from "next/server";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";
import { listAllBlogTags } from "@/lib/blog/blogTags";

export async function GET(req: Request) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const tags = await listAllBlogTags();

  return NextResponse.json({ ok: true, tags });
}
