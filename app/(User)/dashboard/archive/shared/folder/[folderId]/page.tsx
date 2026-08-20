"use client";

import { useParams } from "next/navigation";
import { FolderView } from "@/app/_components/Dahsboard/archive/views/FolderView";

// Id-based counterpart to the code-path route ([...codePath]/page.tsx) for
// folders reached via "Shared with me" — see FolderView's ArchiveLinkMode
// comment for why this can't reuse that route (it requires `view` on every
// ancestor to resolve a code path, which a direct-grant-only viewer won't
// have).
export default function SharedFolderPage() {
  const params = useParams<{ folderId: string }>();
  return <FolderView folderId={params.folderId} codePath={[]} linkMode={{ kind: "sharedId" }} />;
}
