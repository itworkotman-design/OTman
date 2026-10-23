"use client";

import { useRef, useState } from "react";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import {
  MAX_PICKUP_DOCUMENT_SIZE_MB,
  PICKUP_DOCUMENT_ACCEPT,
  checkPickupDocumentFile,
  type PickupDocumentFileProblem,
} from "@/lib/orders/pickupDocuments";
import { FieldLabel } from "./formFieldStyles";
import { DocumentIcon } from "./orderDetailsIcons";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Required receipt / order confirmation for a store pickup, so the driver can
// show the store what to hand over. Type and size are checked the moment a
// file is picked; the file itself is only held in memory and uploaded on
// submit (see pickupDocumentUploads.ts), where the endpoint checks the real
// bytes again.
export function PickupDocumentField({
  locale,
  file,
  onChange,
  showMissing = false,
}: {
  locale: Locale;
  file: File | null;
  onChange: (file: File | null) => void;
  // The visitor moved on without picking one — same red state as an empty
  // required text field.
  showMissing?: boolean;
}) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const inputRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<PickupDocumentFileProblem | null>(null);

  const problemText: Record<PickupDocumentFileProblem, string> = {
    INVALID_TYPE: t("Only PDF, JPG or PNG files can be uploaded.", "Kun PDF-, JPG- eller PNG-filer kan lastes opp."),
    TOO_LARGE: t(
      `The file is too large. The maximum size is ${MAX_PICKUP_DOCUMENT_SIZE_MB} MB.`,
      `Filen er for stor. Maks størrelse er ${MAX_PICKUP_DOCUMENT_SIZE_MB} MB.`,
    ),
    EMPTY: t("The file is empty. Please choose another file.", "Filen er tom. Velg en annen fil."),
  };

  function handlePicked(files: FileList | null) {
    const picked = files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!picked) return;

    const found = checkPickupDocumentFile(picked);
    setProblem(found);
    // A rejected pick keeps whatever valid file was already chosen.
    if (!found) onChange(picked);
  }

  return (
    <div>
      <FieldLabel
        icon={<DocumentIcon className="h-4 w-4" />}
        hint={t(
          "E.g. the receipt or order confirmation, so the driver can show the store what to pick up.",
          "F.eks. kvittering eller ordrebekreftelse, så sjåføren kan vise butikken hva som skal hentes.",
        )}
      >
        {t("Pickup document", "Hentedokument")}
      </FieldLabel>

      <input
        ref={inputRef}
        type="file"
        accept={PICKUP_DOCUMENT_ACCEPT}
        className="hidden"
        onChange={(e) => handlePicked(e.target.files)}
      />

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <DocumentIcon className="h-4 w-4 shrink-0 text-logoblue" />
            <span className="min-w-0 truncate text-black/80">{file.name}</span>
            <span className="shrink-0 text-xs text-black/40">{formatSize(file.size)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
            <button type="button" onClick={() => inputRef.current?.click()} className="text-logoblue hover:underline">
              {t("Replace", "Bytt")}
            </button>
            <button
              type="button"
              onClick={() => {
                setProblem(null);
                onChange(null);
              }}
              className="text-red-600 hover:underline"
            >
              {t("Remove", "Fjern")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3.5 py-3 text-sm font-medium transition hover:bg-logoblue/5 ${
            problem || showMissing ? "border-red-400 text-red-600" : "border-logoblue/30 text-logoblue"
          }`}
        >
          <DocumentIcon className="h-4 w-4" />
          {t("Upload receipt or order confirmation", "Last opp kvittering eller ordrebekreftelse")}
        </button>
      )}

      {problem ? (
        <p className="mt-1.5 text-xs text-red-500">{problemText[problem]}</p>
      ) : showMissing ? (
        <p className="mt-1.5 text-xs text-red-500">
          {t(
            "Upload the receipt or order confirmation to continue (PDF, JPG or PNG).",
            "Last opp kvittering eller ordrebekreftelse for å gå videre (PDF, JPG eller PNG).",
          )}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-black/40">
          {t(
            `PDF, JPG or PNG, max ${MAX_PICKUP_DOCUMENT_SIZE_MB} MB. Sent when you submit the order.`,
            `PDF, JPG eller PNG, maks ${MAX_PICKUP_DOCUMENT_SIZE_MB} MB. Sendes når du sender bestillingen.`,
          )}
        </p>
      )}
    </div>
  );
}
