"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { canAccessArchive } from "@/lib/users/access";
import { bookingText } from "@/lib/booking/bookingUiText";

type ArchiveFolderRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
};

type FoldersApiResponse = {
  ok?: boolean;
  folders?: ArchiveFolderRow[];
  reason?: string;
};

export default function ArchivePage() {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const hasAccess = currentUser ? canAccessArchive(currentUser.role, currentUser.permissions) : true;

  const [folders, setFolders] = useState<ArchiveFolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDescription, setNewFolderDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function loadFolders() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/archive/folders", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as FoldersApiResponse | null;

      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to load folders");
        setFolders([]);
        return;
      }

      setFolders(data.folders ?? []);
    } catch {
      setError("Failed to load folders");
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    if (!hasAccess) return;
    void loadFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, hasAccess]);

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;

    try {
      setCreating(true);
      setCreateError("");

      const res = await fetch("/api/archive/folders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newFolderDescription.trim() || null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setCreateError(data?.reason || "Failed to create folder");
        return;
      }

      setNewFolderName("");
      setNewFolderDescription("");
      await loadFolders();
    } catch {
      setCreateError("Failed to create folder");
    } finally {
      setCreating(false);
    }
  }

  if (currentUser && !hasAccess) {
    return (
      <div className="w-full">
        <p className="text-textColorThird">
          {locale === "nb" ? "Du har ikke tilgang til arkivet." : "You do not have access to the archive."}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
            {bookingText(locale, "Archive")}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-textColorThird">
            {locale === "nb"
              ? "Opprett og bla gjennom mapper i arkivet."
              : "Create and browse root folders in the archive."}
          </p>
        </div>

        {!loading && !error && (
          <div className="customInput px-4 py-2 text-sm font-medium text-textColorThird">
            {folders.length} {locale === "nb" ? "mapper" : folders.length === 1 ? "folder" : "folders"}
          </div>
        )}
      </div>

      <div className="customContainer mb-6 p-4">
        <h2 className="mb-3 font-semibold text-logoblue">
          {locale === "nb" ? "Ny mappe" : "New folder"}
        </h2>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200] flex-1">
            <label className="block pb-2 text-sm">{locale === "nb" ? "Navn" : "Name"}</label>
            <input
              className="customInput w-full"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              type="text"
              disabled={creating}
            />
          </div>

          <div className="min-w-[240] flex-1">
            <label className="block pb-2 text-sm">{locale === "nb" ? "Beskrivelse" : "Description"}</label>
            <input
              className="customInput w-full"
              value={newFolderDescription}
              onChange={(e) => setNewFolderDescription(e.target.value)}
              type="text"
              disabled={creating}
            />
          </div>

          <button
            type="button"
            className="customButtonEnabled h-10 px-6"
            onClick={() => void handleCreateFolder()}
            disabled={creating || !newFolderName.trim()}
          >
            {creating ? (locale === "nb" ? "Oppretter..." : "Creating...") : locale === "nb" ? "Opprett" : "Create"}
          </button>
        </div>

        {createError && <p className="mt-3 text-sm font-medium text-red-600">{createError}</p>}
      </div>

      <div className="min-w-0 w-full overflow-x-auto">
        {loading ? (
          <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
            {locale === "nb" ? "Laster mapper..." : "Loading folders..."}
          </div>
        ) : error ? (
          <div className="customContainer flex items-center justify-center border-red-200! bg-red-50 py-10 text-sm font-medium text-red-600">
            {error}
          </div>
        ) : folders.length === 0 ? (
          <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
            {locale === "nb" ? "Ingen mapper funnet" : "No folders found"}
          </div>
        ) : (
          <div className="customContainer divide-y divide-lineSecondary">
            {folders.map((folder) => (
              <Link
                key={folder.id}
                href={`/dashboard/archive/${folder.id}`}
                className="flex items-center justify-between gap-4 py-3 px-2 hover:bg-linePrimary"
              >
                <div>
                  <div className="font-medium text-textcolor">{folder.name}</div>
                  {folder.description && (
                    <div className="text-sm text-textColorThird">{folder.description}</div>
                  )}
                </div>
                <div className="text-sm text-textColorThird">{folder.status}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
