"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { buildCustomerEditPayload, type CustomerEditDraft } from "./customerEditPayload";

type Props = {
  orderNumber: string;
  // The order as loaded, and as it is now in the editor.
  initial: CustomerEditDraft;
  current: CustomerEditDraft;
  beforeCutoff: boolean;
  locale: Locale;
  onCancel: () => void;
  onSaved: (message: string) => void;
};

const PREVIEW_DELAY_MS = 800;

function kr(n: number) {
  return `${n.toLocaleString("nb-NO")} kr`;
}

// The save bar when a customer changes their own order in "My order": every
// change is priced by the server (dryRun), and that price is what the save
// confirms (shownTotal) — the order is only changed at the price shown.
export default function CustomerOrderEditFooter({ orderNumber, initial, current, beforeCutoff, locale, onCancel, onSaved }: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const [preview, setPreview] = useState<{ previousPriceExVat: number; priceExVat: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewSeq = useRef(0);

  const payload = buildCustomerEditPayload(initial, current, beforeCutoff);
  const payloadKey = JSON.stringify(payload);
  const hasChanges = payloadKey !== "{}";

  const reasonText: Record<string, string> = {
    EDIT_NOT_ALLOWED: t(
      "Some of these changes can't be made this close to the job. Contact us.",
      "Noen av endringene kan ikke gjøres så nær oppdraget. Ta kontakt med oss.",
    ),
    ORDER_CLOSED: t("This order can't be changed any more.", "Denne bestillingen kan ikke endres lenger."),
    INVALID_SCHEDULE: t(
      "Pick a date and time at least 24 hours ahead (not Sundays or public holidays).",
      "Velg dato og tid minst 24 timer frem i tid (ikke søndager eller helligdager).",
    ),
    INVALID_DETAILS: t("Check your name, phone and email.", "Sjekk navn, telefon og e-post."),
    WOULD_DECREASE_PRICE: t(
      "This change would lower the price of a paid order. Contact us and we'll sort it out.",
      "Endringen ville senket prisen på en betalt bestilling. Ta kontakt, så ordner vi det.",
    ),
    SIZE_BRACKETS_REQUIRED: t("Choose a size and weight for every item.", "Velg størrelse og vekt for alle varer."),
    ITEM_NAME_REQUIRED: t("Say what each item is.", "Skriv hva hver vare er."),
    INSTALL_OPTION_REQUIRED: t("Choose an installation option.", "Velg et monteringsvalg."),
    INSTALL_ADDON_NOT_ALLOWED: t(
      "One of the installation add-ons doesn't go with the installation you chose. Check the installation choices.",
      "Et av monteringstilleggene passer ikke med monteringen du har valgt. Sjekk monteringsvalgene.",
    ),
    UNKNOWN_PRODUCT: t("One of the products can't be ordered on the website.", "En av varene kan ikke bestilles på nettsiden."),
    UNAUTHORIZED: t("You have been logged out. Log in again.", "Du er logget ut. Logg inn igjen."),
  };
  const errorMessage = (reason: unknown) =>
    (typeof reason === "string" && reasonText[reason]) || t("Couldn't save the changes.", "Kunne ikke lagre endringene.");

  async function send(body: Record<string, unknown>) {
    const res = await fetch(`/api/customer/orders/${encodeURIComponent(orderNumber)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...payload, ...body }),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok && !!json?.ok, json };
  }

  // The price of the changes, from the server (debounced).
  useEffect(() => {
    const seq = ++previewSeq.current;
    if (!hasChanges) {
      setPreview(null);
      setError("");
      return;
    }
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const { ok, json } = await send({ dryRun: true });
        if (seq !== previewSeq.current) return;
        if (ok) {
          setPreview({ previousPriceExVat: json.previousPriceExVat, priceExVat: json.priceExVat });
          setError("");
        } else {
          setPreview(null);
          setError(errorMessage(json?.reason));
        }
      } catch {
        if (seq === previewSeq.current) setPreview(null);
      } finally {
        if (seq === previewSeq.current) setPreviewing(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey]);

  async function save() {
    if (!hasChanges || saving) return;
    setError("");
    setSaving(true);
    try {
      const { ok, json } = await send(preview ? { shownTotal: preview.priceExVat } : {});
      if (!ok) {
        if (json?.reason === "PRICE_CHANGED" && typeof json.priceExVat === "number") {
          setPreview((p) => (p ? { ...p, priceExVat: json.priceExVat } : p));
          setError(t("The price was updated — check it and save again.", "Prisen er oppdatert — sjekk den og lagre på nytt."));
          return;
        }
        setError(errorMessage(json?.reason));
        return;
      }
      onSaved(
        json.priceExVat !== json.previousPriceExVat
          ? t(`Your order is updated. New total: ${kr(json.priceExVat)}.`, `Bestillingen er oppdatert. Ny totalpris: ${kr(json.priceExVat)}.`)
          : t("Your order is updated.", "Bestillingen er oppdatert."),
      );
    } catch {
      setError(t("Couldn't save the changes.", "Kunne ikke lagre endringene."));
    } finally {
      setSaving(false);
    }
  }

  const delta = preview ? preview.priceExVat - preview.previousPriceExVat : 0;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
      <div className="min-w-0 flex-1 text-sm">
        {!hasChanges ? (
          <p className="text-black/50">{t("Make your changes above.", "Gjør endringene dine over.")}</p>
        ) : previewing ? (
          <p className="text-black/50">{t("Calculating price…", "Beregner pris…")}</p>
        ) : preview ? (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between gap-4">
              <span className="text-black/60">{t("Price before", "Pris før")}</span>
              <span className="tabular-nums">{kr(preview.previousPriceExVat)}</span>
            </div>
            <div className="flex justify-between gap-4 font-semibold text-logoblue">
              <span>{t("New total (incl. VAT)", "Ny totalpris (inkl. MVA)")}</span>
              <span className="tabular-nums">{kr(preview.priceExVat)}</span>
            </div>
            {delta !== 0 && (
              <p className="text-xs text-black/60">
                {delta > 0
                  ? t(`${kr(delta)} more than before.`, `${kr(delta)} mer enn før.`)
                  : t(`${kr(-delta)} less than before.`, `${kr(-delta)} mindre enn før.`)}
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-2 lg:w-72">
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button
          type="button"
          onClick={save}
          disabled={!hasChanges || saving || previewing || (!preview && !!error)}
          className="inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? t("Saving…", "Lagrer…") : t("Save changes", "Lagre endringer")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-sm font-semibold text-black/60 hover:text-black disabled:opacity-50"
        >
          {t("Cancel", "Avbryt")}
        </button>
      </div>
    </div>
  );
}
