"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUserLanguage } from "@/lib/users/language";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { ItemView } from "@/app/_components/Dahsboard/archive/views/ItemView";

// Id-based counterpart to the code-path route for items reached via "Shared
// with me" — see FolderView's ArchiveLinkMode comment for the rationale.
// ItemView needs the item's containing folderId, which the URL alone
// doesn't carry (unlike the code-path route, where it's implicit in the
// resolved path), so this resolves it via a lightweight lookup first.
export default function SharedItemPage() {
  const params = useParams<{ itemId: string }>();
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);

  const [folderId, setFolderId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/archive/items/${params.itemId}`, { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && data.item?.folderId) {
          setFolderId(data.item.folderId);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });

    return () => {
      cancelled = true;
    };
  }, [params.itemId]);

  if (notFound) {
    return (
      <div className="w-full">
        <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
          {locale === "nb" ? "Fant ikke dette elementet." : "Couldn't find that item."}
        </div>
      </div>
    );
  }

  if (!folderId) {
    return (
      <div className="w-full">
        <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
          {locale === "nb" ? "Laster..." : "Loading..."}
        </div>
      </div>
    );
  }

  return <ItemView folderId={folderId} itemId={params.itemId} codePath={[]} linkMode={{ kind: "sharedId" }} />;
}
