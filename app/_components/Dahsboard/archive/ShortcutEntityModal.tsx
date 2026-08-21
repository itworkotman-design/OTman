"use client";

import { DestinationPicker } from "@/app/_components/Dahsboard/archive/DestinationPicker";

type ShortcutEntityModalProps = {
  itemId: string;
  itemName: string;
  locale: string;
  onClose: () => void;
  onShortcutCreated: () => void;
};

function errorMessage(locale: string, reason: string | undefined): string {
  if (reason === "SAME_FOLDER") {
    return locale === "nb" ? "Elementet ligger allerede i denne mappen." : "The item already lives in that folder.";
  }
  if (reason === "DUPLICATE") {
    return locale === "nb" ? "Det finnes allerede en snarvei hit." : "A shortcut to this item already exists there.";
  }
  if (reason === "INVALID_SECTION") {
    return locale === "nb" ? "Ugyldig seksjon" : "Invalid section";
  }
  return locale === "nb" ? "Kunne ikke legge til snarvei" : "Failed to add shortcut";
}

// Destination picker for adding a shortcut to an item — same shared
// DestinationPicker UX as MoveEntityModal, but the real item never moves:
// onSubmit POSTs to the shortcut-creation route instead of PATCHing the
// item's folder. Folders are never shortcut-able (only items), so `kind` is
// always "item" here.
export function ShortcutEntityModal({ itemId, itemName, locale, onClose, onShortcutCreated }: ShortcutEntityModalProps) {
  return (
    <DestinationPicker
      kind="item"
      entityId={itemId}
      entityName={itemName}
      locale={locale}
      title={locale === "nb" ? "Legg til snarvei" : "Add shortcut"}
      confirmHereLabel={locale === "nb" ? "Legg til snarvei her" : "Add shortcut here"}
      createAndConfirmLabel={locale === "nb" ? "Opprett og legg til snarvei" : "Create & add shortcut here"}
      creatingAndConfirmingLabel={locale === "nb" ? "Oppretter og legger til..." : "Creating & adding..."}
      onClose={onClose}
      onSubmit={async (folderId, sectionId) => {
        const res = await fetch(`/api/archive/items/${itemId}/shortcut`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId, sectionId }),
        });
        const data = await res.json().catch(() => null);
        return res.ok && data?.ok ? { ok: true } : { ok: false, reason: data?.reason };
      }}
      errorText={(reason) => errorMessage(locale, reason)}
      onSuccess={() => {
        onShortcutCreated();
        onClose();
      }}
    />
  );
}
