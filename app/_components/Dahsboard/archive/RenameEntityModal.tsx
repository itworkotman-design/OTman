"use client";

import { useState, type FormEvent } from "react";

type RenameEntityModalProps = {
  kind: "item" | "folder";
  entityId: string;
  currentName: string;
  locale: string;
  onClose: () => void;
  onRenamed: () => void;
};

// Same overlay/card shell as MoveEntityModal, scaled down to a single field
// — replaces the old window.prompt() rename, which looked out of place next
// to every other pill action already using this app's own modal styling.
export function RenameEntityModal({ kind, entityId, currentName, locale, onClose, onRenamed }: RenameEntityModalProps) {
  const [name, setName] = useState(currentName);
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState("");

  const trimmed = name.trim();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || trimmed === currentName || renaming) return;

    try {
      setRenaming(true);
      setError("");

      const basePath = kind === "folder" ? `/api/archive/folders/${entityId}` : `/api/archive/items/${entityId}`;
      const res = await fetch(`${basePath}/name`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.message || (locale === "nb" ? "Kunne ikke gi nytt navn" : "Failed to rename"));
        return;
      }

      onRenamed();
      onClose();
    } finally {
      setRenaming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-lg font-bold text-textcolor">
            {locale === "nb" ? "Gi nytt navn" : "Rename"} &ldquo;{currentName}&rdquo;
          </h2>
          <button type="button" className="customButtonDefault shrink-0" onClick={onClose}>
            {locale === "nb" ? "Lukk" : "Close"}
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="customInput w-full"
            autoFocus
            disabled={renaming}
          />

          {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="customButtonDefault" onClick={onClose} disabled={renaming}>
              {locale === "nb" ? "Avbryt" : "Cancel"}
            </button>
            <button type="submit" className="customButtonEnabled" disabled={renaming || !trimmed || trimmed === currentName}>
              {renaming ? (locale === "nb" ? "Lagrer..." : "Saving...") : locale === "nb" ? "Lagre" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
