"use client";

import { useState } from "react";

type UploadResult = { storagePath: string; key: string };

export function useBlogImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File, blogPostId: string): Promise<UploadResult | null> {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("blogPostId", blogPostId);

      const res = await fetch("/api/dashboard/website/blog/assets", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok || !body?.ok) {
        setError(body?.reason ?? "UPLOAD_FAILED");
        return null;
      }

      return { storagePath: body.storagePath, key: body.key };
    } catch {
      setError("UPLOAD_FAILED");
      return null;
    } finally {
      setIsUploading(false);
    }
  }

  return { upload, isUploading, error };
}
