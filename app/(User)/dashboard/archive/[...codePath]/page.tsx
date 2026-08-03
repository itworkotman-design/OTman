"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useUserLanguage } from "@/lib/users/language";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { FolderView } from "@/app/_components/Dahsboard/archive/views/FolderView";
import { FolderSettingsView } from "@/app/_components/Dahsboard/archive/views/FolderSettingsView";
import { ItemView } from "@/app/_components/Dahsboard/archive/views/ItemView";
import { ItemSettingsView } from "@/app/_components/Dahsboard/archive/views/ItemSettingsView";

type ResolvedTarget =
  | { type: "folder"; folderId: string }
  | { type: "item"; itemId: string; folderId: string };

// Every archive URL below the root is the entity's own display code with
// dots turned into slashes (e.g. "1.2F.3F" -> /dashboard/archive/1/2F/3F),
// optionally with a trailing "/settings" — never the entity's opaque id.
// This route resolves that code path to a real folder/item id (via
// /api/archive/resolve-path) and then hands off to the matching view; the
// views themselves still do all their own data fetching by id exactly as
// before, they just no longer read that id from the URL directly.
export default function ArchiveCodePathPage() {
  const params = useParams<{ codePath: string[] }>();
  const rawSegments = params.codePath ?? [];

  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);

  const isSettings = rawSegments[rawSegments.length - 1] === "settings";
  const codePath = isSettings ? rawSegments.slice(0, -1) : rawSegments;
  const joinedPath = codePath.join("/");

  const [resolved, setResolved] = useState<ResolvedTarget | null>(null);
  const [resolving, setResolving] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolvePath() {
      setResolving(true);
      setNotFound(false);
      setResolved(null);

      if (codePath.length === 0) {
        if (!cancelled) {
          setNotFound(true);
          setResolving(false);
        }
        return;
      }

      try {
        const res = await fetch(`/api/archive/resolve-path?path=${encodeURIComponent(joinedPath)}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);

        if (cancelled) return;

        if (!res.ok || !data?.ok) {
          setNotFound(true);
          return;
        }

        setResolved(
          data.type === "item"
            ? { type: "item", itemId: data.itemId, folderId: data.folderId }
            : { type: "folder", folderId: data.folderId },
        );
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setResolving(false);
      }
    }

    void resolvePath();
    return () => {
      cancelled = true;
    };
  }, [joinedPath, codePath.length]);

  if (resolving) {
    return (
      <div className="w-full">
        <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
          {locale === "nb" ? "Laster..." : "Loading..."}
        </div>
      </div>
    );
  }

  if (notFound || !resolved) {
    return (
      <div className="w-full">
        <div className="customContainer flex flex-col items-center gap-3 py-10 text-center text-sm text-textColorThird">
          <p>{locale === "nb" ? "Fant ikke denne siden i arkivet." : "Couldn't find that in the archive."}</p>
          <Link href="/dashboard/archive" className="customButtonDefault">
            {locale === "nb" ? "Tilbake til arkiv" : "Back to archive"}
          </Link>
        </div>
      </div>
    );
  }

  if (resolved.type === "item") {
    return isSettings ? (
      <ItemSettingsView itemId={resolved.itemId} codePath={codePath} />
    ) : (
      <ItemView folderId={resolved.folderId} itemId={resolved.itemId} codePath={codePath} />
    );
  }

  return isSettings ? (
    <FolderSettingsView folderId={resolved.folderId} codePath={codePath} />
  ) : (
    <FolderView folderId={resolved.folderId} codePath={codePath} />
  );
}
