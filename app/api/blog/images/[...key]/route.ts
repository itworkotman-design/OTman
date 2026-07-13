import { NextResponse } from "next/server";
import { getSignedAttachmentUrl } from "@/lib/orders/orderAttachmentStorage";

type RouteParams = { params: Promise<{ key: string[] }> };

// Public, unauthenticated by design: blog cover/section images are public
// content. This route exists so publicly-cached HTML/OG tags can embed a
// stable URL instead of a presigned S3 URL that expires in minutes — every
// request here issues a fresh signed URL and 302-redirects to it.
export async function GET(_req: Request, { params }: RouteParams) {
  const { key } = await params;
  const storagePath = `s3://${key.join("/")}`;

  const signedUrl = await getSignedAttachmentUrl({
    storagePath,
    filename: key[key.length - 1] ?? "image",
    mimeType: null,
    download: false,
  });

  if (!signedUrl) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.redirect(signedUrl);
}
