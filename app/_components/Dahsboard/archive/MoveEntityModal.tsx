"use client";

import { DestinationPicker } from "@/app/_components/Dahsboard/archive/DestinationPicker";

type MoveEntityModalProps = {
  kind: "item" | "folder";
  entityId: string;
  entityName: string;
  locale: string;
  onClose: () => void;
  onMoved: () => void;
};

function errorMessage(kind: "item" | "folder", locale: string, reason: string | undefined): string {
  if (reason === "SAME_FOLDER") {
    return kind === "item"
      ? locale === "nb"
        ? "Elementet er allerede i denne mappen."
        : "The item is already in that folder."
      : locale === "nb"
        ? "Mappen er allerede der."
        : "The folder is already there.";
  }
  if (reason === "CYCLE") {
    return locale === "nb"
      ? "Kan ikke flytte en mappe inn i seg selv eller en av sine egne undermapper."
      : "Can't move a folder into itself or one of its own subfolders.";
  }
  if (reason === "INVALID_SECTION") {
    return locale === "nb" ? "Ugyldig seksjon" : "Invalid section";
  }
  return locale === "nb" ? "Kunne ikke flytte" : "Failed to move";
}

// Destination picker for moving an item or folder — see DestinationPicker
// for the shared browse/breadcrumb/section-pick UX (also reused by
// ShortcutEntityModal). This wrapper only owns move's own semantics: which
// PATCH route to call and how to read its error reasons.
export function MoveEntityModal({ kind, entityId, entityName, locale, onClose, onMoved }: MoveEntityModalProps) {
  return (
    <DestinationPicker
      kind={kind}
      entityId={entityId}
      entityName={entityName}
      locale={locale}
      title={locale === "nb" ? "Flytt" : "Move"}
      confirmHereLabel={locale === "nb" ? "Flytt hit" : "Move here"}
      createAndConfirmLabel={locale === "nb" ? "Opprett og flytt hit" : "Create & move here"}
      creatingAndConfirmingLabel={locale === "nb" ? "Oppretter og flytter..." : "Creating & moving..."}
      onClose={onClose}
      onSubmit={async (folderId, sectionId) => {
        const res =
          kind === "item"
            ? await fetch(`/api/archive/items/${entityId}/folder`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folderId, sectionId }),
              })
            : await fetch(`/api/archive/folders/${entityId}/parent`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentFolderId: folderId, sectionId }),
              });

        const data = await res.json().catch(() => null);
        return res.ok && data?.ok ? { ok: true } : { ok: false, reason: data?.reason };
      }}
      errorText={(reason) => errorMessage(kind, locale, reason)}
      onSuccess={() => {
        onMoved();
        onClose();
      }}
    />
  );
}
