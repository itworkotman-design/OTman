"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { canAccessArchive } from "@/lib/users/access";

type ArchiveFolderDetail = {
  id: string;
  name: string;
  description: string | null;
};

type ArchiveItemRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
};

type ArchiveFileRow = {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function ArchiveFolderPage() {
  const params = useParams<{ folderId: string }>();
  const folderId = params.folderId;

  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const hasAccess = currentUser ? canAccessArchive(currentUser.role, currentUser.permissions) : true;

  const [folder, setFolder] = useState<ArchiveFolderDetail | null>(null);
  const [items, setItems] = useState<ArchiveItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newItemName, setNewItemName] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [filesByItemId, setFilesByItemId] = useState<Record<string, ArchiveFileRow[]>>({});
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");

  async function loadFolderAndItems() {
    try {
      setLoading(true);
      setError("");

      const [folderRes, itemsRes] = await Promise.all([
        fetch(`/api/archive/folders/${folderId}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/items`, { credentials: "include", cache: "no-store" }),
      ]);

      const folderData = await folderRes.json().catch(() => null);
      const itemsData = await itemsRes.json().catch(() => null);

      if (!folderRes.ok || !folderData?.ok) {
        setError(folderData?.reason || "Failed to load folder");
        return;
      }

      setFolder(folderData.folder);

      if (!itemsRes.ok || !itemsData?.ok) {
        setError(itemsData?.reason || "Failed to load items");
        return;
      }

      setItems(itemsData.items ?? []);
    } catch {
      setError("Failed to load folder");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    if (!hasAccess) return;
    if (!folderId) return;
    void loadFolderAndItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, hasAccess, folderId]);

  async function handleCreateItem() {
    const name = newItemName.trim();
    if (!name) return;

    try {
      setCreating(true);
      setCreateError("");

      const res = await fetch(`/api/archive/folders/${folderId}/items`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: newItemDescription.trim() || null }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setCreateError(data?.reason || "Failed to create item");
        return;
      }

      setNewItemName("");
      setNewItemDescription("");
      await loadFolderAndItems();
    } catch {
      setCreateError("Failed to create item");
    } finally {
      setCreating(false);
    }
  }

  async function loadFiles(itemId: string) {
    try {
      setFilesLoading(true);

      const res = await fetch(`/api/archive/items/${itemId}/files`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) return;

      setFilesByItemId((prev) => ({ ...prev, [itemId]: data.files ?? [] }));
    } finally {
      setFilesLoading(false);
    }
  }

  function handleToggleItem(itemId: string) {
    const next = expandedItemId === itemId ? null : itemId;
    setExpandedItemId(next);

    if (next && !filesByItemId[next]) {
      void loadFiles(next);
    }
  }

  async function handleUploadFile(itemId: string, file: File) {
    try {
      setUploadingItemId(itemId);
      setUploadError("");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/archive/items/${itemId}/files`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setUploadError(data?.reason || "Upload failed");
        return;
      }

      await loadFiles(itemId);
    } catch {
      setUploadError("Upload failed");
    } finally {
      setUploadingItemId(null);
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
      <Link href="/dashboard/archive" className="mb-4 inline-block text-sm text-textColorThird hover:underline">
        {locale === "nb" ? "← Tilbake til arkivet" : "← Back to archive"}
      </Link>

      <div className="mb-8">
        <h1 className="whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
          {loading ? "..." : folder?.name || (locale === "nb" ? "Ukjent mappe" : "Unknown folder")}
        </h1>
        {folder?.description && <p className="mt-2 max-w-xl text-sm text-textColorThird">{folder.description}</p>}
      </div>

      {error && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="customContainer mb-6 p-4">
        <h2 className="mb-3 font-semibold text-logoblue">{locale === "nb" ? "Nytt element" : "New item"}</h2>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200] flex-1">
            <label className="block pb-2 text-sm">{locale === "nb" ? "Navn" : "Name"}</label>
            <input
              className="customInput w-full"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              type="text"
              disabled={creating}
            />
          </div>

          <div className="min-w-[240] flex-1">
            <label className="block pb-2 text-sm">{locale === "nb" ? "Beskrivelse" : "Description"}</label>
            <input
              className="customInput w-full"
              value={newItemDescription}
              onChange={(e) => setNewItemDescription(e.target.value)}
              type="text"
              disabled={creating}
            />
          </div>

          <button
            type="button"
            className="customButtonEnabled h-10 px-6"
            onClick={() => void handleCreateItem()}
            disabled={creating || !newItemName.trim()}
          >
            {creating ? (locale === "nb" ? "Oppretter..." : "Creating...") : locale === "nb" ? "Opprett" : "Create"}
          </button>
        </div>

        {createError && <p className="mt-3 text-sm font-medium text-red-600">{createError}</p>}
      </div>

      <div className="min-w-0 w-full overflow-x-auto">
        {loading ? (
          <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
            {locale === "nb" ? "Laster elementer..." : "Loading items..."}
          </div>
        ) : items.length === 0 ? (
          <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
            {locale === "nb" ? "Ingen elementer funnet" : "No items found"}
          </div>
        ) : (
          <div className="customContainer divide-y divide-lineSecondary">
            {items.map((item) => {
              const isExpanded = expandedItemId === item.id;
              const files = filesByItemId[item.id] ?? [];

              return (
                <div key={item.id} className="py-3 px-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 text-left"
                    onClick={() => handleToggleItem(item.id)}
                  >
                    <div>
                      <div className="font-medium text-textcolor">{item.name}</div>
                      {item.description && <div className="text-sm text-textColorThird">{item.description}</div>}
                    </div>
                    <div className="text-sm text-textColorThird">{isExpanded ? "▲" : "▼"}</div>
                  </button>

                  {isExpanded && (
                    <div className="mt-3 pl-2">
                      {filesLoading && !filesByItemId[item.id] ? (
                        <div className="text-sm text-textColorThird">
                          {locale === "nb" ? "Laster filer..." : "Loading files..."}
                        </div>
                      ) : files.length === 0 ? (
                        <div className="text-sm text-textColorThird">
                          {locale === "nb" ? "Ingen filer" : "No files"}
                        </div>
                      ) : (
                        <div className="mb-3 flex flex-col gap-1">
                          {files.map((file) => (
                            <div key={file.id} className="flex items-center justify-between gap-3 text-sm">
                              <a
                                href={`/api/archive/files/${file.id}/download`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-logoblue hover:underline"
                              >
                                {file.originalFileName}
                              </a>
                              <span className="text-textColorThird">{formatBytes(file.sizeBytes)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <label className="customButtonDefault inline-block cursor-pointer">
                        {uploadingItemId === item.id
                          ? locale === "nb"
                            ? "Laster opp..."
                            : "Uploading..."
                          : locale === "nb"
                            ? "Last opp fil"
                            : "Upload file"}
                        <input
                          type="file"
                          className="hidden"
                          disabled={uploadingItemId === item.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void handleUploadFile(item.id, file);
                          }}
                        />
                      </label>

                      {uploadError && <p className="mt-2 text-sm font-medium text-red-600">{uploadError}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
