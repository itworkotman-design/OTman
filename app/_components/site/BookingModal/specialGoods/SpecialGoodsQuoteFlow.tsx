"use client";

import { useRef, useState } from "react";
import { SteppedModal, type FinalStep, type StepSection } from "../SteppedModal";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import { transportTimeWindows } from "@/lib/content/TransportRequestConfig";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { MAX_QUOTE_PHOTOS } from "@/lib/orders/pendingQuoteAttachments";
import {
  isValidEmail,
  sanitizeEmailInput,
  sanitizePhoneInput,
  sanitizeTextInput,
  validatePhoneField,
} from "@/lib/orders/websiteOrderValidation";

type Props = {
  locale: Locale;
  onClose: () => void;
};

// Quote-based, like Moving before it: "Andre varer"/"Spesialvarer" are
// oversized/unusual items that can't be auto-priced from a catalog, so this
// collects a description + optional photos and lands as an unpriced Order
// for staff to quote manually — same approve/reject/Stripe pipeline every
// other website order uses. See docs/homepage-ordering-roadmap.md §5.
//
// Photos are held client-side (as plain File objects — nothing touches the
// network) until the final "Request a quote" submit, at which point they're
// uploaded to app/api/site/special-goods-quote/upload/route.ts, grouped by a
// client-generated quoteToken, then linked to the real Order. Deliberately
// NOT uploaded as each photo is picked: someone who selects photos and then
// abandons the form never writes anything to S3/the DB at all — no orphaned
// files, no cleanup job needed for that case.
const METER_OPTIONS = Array.from({ length: 11 }, (_, i) => i);
const CM_OPTIONS = [0, 20, 40, 60, 80];
const WEIGHT_OPTIONS = ["Under 10 kg", "Under 30 kg", "Under 50 kg", "Under 100 kg", "Over 100 kg"];


function generateQuoteToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Extremely old browsers only — good enough for a grouping key, not a secret.
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Not-yet-uploaded — held in memory only, keyed by a local id so a photo can
// be removed from the list before it's ever sent anywhere.
type PendingPhoto = { localId: string; file: File };

const ACCEPTED_PHOTO_EXTENSION = /\.(jpe?g|png|webp|heic|heif)$/i;
const ACCEPTED_PHOTO_TYPE = /^image\/(jpeg|png|webp|heic|heif)$/i;

function DimensionSelect({
  label,
  meters,
  cm,
  onMeters,
  onCm,
}: {
  label: string;
  meters: string;
  cm: string;
  onMeters: (v: string) => void;
  onCm: (v: string) => void;
}) {
  const sel =
    "w-full rounded-xl border border-black/10 bg-white px-2 py-2 text-sm text-center text-textColor outline-none transition focus:border-logoblue/30 focus:ring-2 focus:ring-logoblue/10";
  return (
    <div className="flex w-full items-center gap-4">
      <span className="w-16 shrink-0 text-sm text-black/55">{label}</span>
      <div className="flex flex-1 min-w-0 items-center gap-1.5">
        <select value={meters} onChange={(e) => onMeters(e.target.value)} className={sel}>
          <option value="">—</option>
          {METER_OPTIONS.map((m) => (
            <option key={m} value={String(m)}>
              {m}
            </option>
          ))}
        </select>
        <span className="text-xs font-medium text-black/40">m</span>
      </div>
      <div className="flex flex-1 min-w-0 items-center gap-1.5">
        <select value={cm} onChange={(e) => onCm(e.target.value)} className={sel}>
          <option value="">—</option>
          {CM_OPTIONS.map((c) => (
            <option key={c} value={String(c)}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-xs font-medium text-black/40">cm</span>
      </div>
    </div>
  );
}

export function SpecialGoodsQuoteFlow({ locale, onClose }: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const [quoteToken] = useState(generateQuoteToken);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState("");
  const [sizeWm, setSizeWm] = useState("");
  const [sizeWcm, setSizeWcm] = useState("");
  const [sizeHm, setSizeHm] = useState("");
  const [sizeHcm, setSizeHcm] = useState("");
  const [sizeLm, setSizeLm] = useState("");
  const [sizeLcm, setSizeLcm] = useState("");
  const [weight, setWeight] = useState("");
  const [units, setUnits] = useState("");

  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [timeWindow, setTimeWindow] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{ orderNumber: string } | null>(null);

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const remaining = MAX_QUOTE_PHOTOS - photos.length;
    // Advisory only (the server sniffs the real bytes); catches a wrong file
    // at pick time instead of as a failed upload at submit. Some browsers
    // report an empty type for .heic, hence the extension fallback.
    const images = Array.from(files).filter((f) => ACCEPTED_PHOTO_EXTENSION.test(f.name) || ACCEPTED_PHOTO_TYPE.test(f.type));
    const picked = images.slice(0, Math.max(0, remaining));
    if (images.length < files.length) {
      setUploadError(
        t(
          "Only photos are accepted (JPEG, PNG, WebP or HEIC).",
          "Kun bilder er tillatt (JPEG, PNG, WebP eller HEIC).",
        ),
      );
    } else if (picked.length < images.length) {
      setUploadError(t(`You can add up to ${MAX_QUOTE_PHOTOS} photos.`, `Du kan legge ved opptil ${MAX_QUOTE_PHOTOS} bilder.`));
    }

    // Nothing is uploaded here — just held in memory until final submit.
    setPhotos((prev) => [...prev, ...picked.map((file) => ({ localId: crypto.randomUUID(), file }))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(localId: string) {
    // Purely local — nothing was ever sent anywhere for this photo yet.
    setPhotos((prev) => prev.filter((p) => p.localId !== localId));
  }

  // Uploads every picked photo, in order, under the shared quoteToken —
  // called only once, right before the order itself is created. Returns
  // false (and leaves submitError set) if any photo fails, so a partial set
  // of photos never gets silently attached to the order.
  async function uploadPhotosBeforeSubmit(): Promise<boolean> {
    for (const photo of photos) {
      const form = new FormData();
      form.append("file", photo.file);
      form.append("quoteToken", quoteToken);
      try {
        const res = await fetch("/api/site/special-goods-quote/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setSubmitError(t("Could not upload one of the photos. Please try again.", "Kunne ikke laste opp ett av bildene. Prøv igjen."));
          return false;
        }
      } catch {
        setSubmitError(t("Could not upload one of the photos. Please try again.", "Kunne ikke laste opp ett av bildene. Prøv igjen."));
        return false;
      }
    }
    return true;
  }

  const canContinueDetails = !!description.trim();
  const canContinueLocation = !!pickupAddress.trim() && !!deliveryAddress.trim();
  const canContinueTiming = !!preferredDate && !!timeWindow;
  const canSubmit =
    !!name.trim() && validatePhoneField(phone) === null && isValidEmail(email) && !submitLoading;

  const fmtDim = (m: string, c: string) => (m || c ? `${m || "0"}m ${c || "0"}cm` : "");

  async function handleSubmit() {
    setSubmitLoading(true);
    setSubmitError(null);

    if (photos.length > 0) {
      const uploaded = await uploadPhotosBeforeSubmit();
      if (!uploaded) {
        setSubmitLoading(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/site/special-goods-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          sizeW: fmtDim(sizeWm, sizeWcm),
          sizeH: fmtDim(sizeHm, sizeHcm),
          sizeL: fmtDim(sizeLm, sizeLcm),
          weight,
          units,
          pickupAddress,
          deliveryAddress,
          preferredDate,
          timeWindow,
          name,
          phone,
          email,
          notes,
          quoteToken: photos.length > 0 ? quoteToken : "",
          _hp: honeypotRef.current?.value ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSubmitError(t("Something went wrong. Please try again.", "Noe gikk galt. Prøv igjen."));
        return;
      }
      setSubmitResult({ orderNumber: data.orderNumber ?? String(data.displayId) });
    } catch {
      setSubmitError(t("Something went wrong. Please try again.", "Noe gikk galt. Prøv igjen."));
    } finally {
      setSubmitLoading(false);
    }
  }

  const sections: StepSection[] = [
    {
      id: "item-details",
      title: t("Tell us about the item", "Fortell oss om varen"),
      description: t(
        "Dimensions and weight are optional but help us quote accurately.",
        "Mål og vekt er valgfritt, men hjelper oss å gi et nøyaktig tilbud.",
      ),
      render: ({ onComplete }) => (
        <div className="flex flex-col gap-3">
          <textarea
            value={description}
            onChange={(e) => setDescription(sanitizeTextInput(e.target.value))}
            rows={3}
            placeholder={t("What is it, and anything else we should know?", "Hva er det, og noe annet vi bør vite?")}
            className="rounded-lg border border-black/15 px-2 py-1.5 text-sm"
          />
          <div className="flex flex-col gap-2 rounded-xl border border-black/10 p-3">
            <DimensionSelect label={t("Width", "Bredde")} meters={sizeWm} cm={sizeWcm} onMeters={setSizeWm} onCm={setSizeWcm} />
            <DimensionSelect label={t("Height", "Høyde")} meters={sizeHm} cm={sizeHcm} onMeters={setSizeHm} onCm={setSizeHcm} />
            <DimensionSelect label={t("Length", "Lengde")} meters={sizeLm} cm={sizeLcm} onMeters={setSizeLm} onCm={setSizeLcm} />
          </div>
          <div className="flex gap-3">
            <select
              className="flex-1 min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-textColor outline-none transition focus:border-logoblue/30 focus:ring-2 focus:ring-logoblue/10"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            >
              <option value="">{t("Weight (optional)", "Vekt (valgfri)")}</option>
              {WEIGHT_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <input
              className="flex-1 min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-textColor outline-none transition placeholder:text-black/30 focus:border-logoblue/30 focus:ring-2 focus:ring-logoblue/10"
              inputMode="numeric"
              placeholder={t("Units (optional)", "Antall enheter (valgfri)")}
              value={units}
              onChange={(e) => setUnits(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <button
            type="button"
            disabled={!canContinueDetails}
            onClick={onComplete}
            className="self-start inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
          >
            {t("Continue", "Fortsett")}
          </button>
        </div>
      ),
    },
    {
      id: "photos",
      title: t("Photos (optional)", "Bilder (valgfritt)"),
      description: t("A photo or two makes it much easier for us to quote accurately.", "Ett eller to bilder gjør det mye lettere for oss å gi et nøyaktig tilbud."),
      render: ({ onComplete }) => (
        <div className="flex flex-col gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={photos.length >= MAX_QUOTE_PHOTOS}
            className="self-start rounded-full customContainer bg-white px-5 py-2.5 text-sm font-semibold text-logoblue transition hover:bg-logoblue/5 disabled:pointer-events-none disabled:opacity-40"
          >
            {t("Add photos", "Legg til bilder")}
          </button>
          <p className="text-xs text-black/40">
            {t("Photos are only sent when you submit your request.", "Bilder sendes først når du sender inn forespørselen.")}
          </p>
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
          {photos.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {photos.map((photo) => (
                <li key={photo.localId} className="flex items-center justify-between gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-black/70">{photo.file.name}</span>
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.localId)}
                    className="shrink-0 text-black/40 transition hover:text-red-500"
                    aria-label={t("Remove", "Fjern")}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onComplete}
            className="self-start inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            {t("Continue", "Fortsett")}
          </button>
        </div>
      ),
    },
    {
      id: "location",
      title: t("Pickup & delivery", "Henting og levering"),
      render: ({ onComplete }) => (
        <div className="flex flex-col gap-3">
          <AddressAutocompleteInput value={pickupAddress} onChange={(v) => setPickupAddress(sanitizeTextInput(v))} placeholder={t("Pickup address", "Henteadresse")} />
          <AddressAutocompleteInput value={deliveryAddress} onChange={(v) => setDeliveryAddress(sanitizeTextInput(v))} placeholder={t("Delivery address", "Leveringsadresse")} />
          <input
            type="date"
            value={preferredDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setPreferredDate(e.target.value)}
            className="h-11 rounded-lg border border-black/15 px-2 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {transportTimeWindows.map((window) => {
              const active = timeWindow === window;
              return (
                <button
                  key={window}
                  type="button"
                  onClick={() => setTimeWindow(window)}
                  className={`rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition ${
                    active ? "border-logoblue bg-logoblue text-white" : "border-black/8 bg-white text-logoblue"
                  }`}
                >
                  {window.replace(/:00/g, "")}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!canContinueTiming || !canContinueLocation}
            onClick={onComplete}
            className="self-start inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
          >
            {t("Continue", "Fortsett")}
          </button>
        </div>
      ),
    },
    {
      id: "your-details",
      title: t("Your details", "Dine opplysninger"),
      render: ({ onComplete }) => (
        <div className="flex flex-col gap-3">
          {/* Honeypot — real visitors never see or fill this field. */}
          <input
            ref={honeypotRef}
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
            aria-hidden="true"
          />
          <input
            value={name}
            onChange={(e) => setName(sanitizeTextInput(e.target.value))}
            placeholder={t("Full name", "Fullt navn")}
            className="h-11 rounded-lg border border-black/15 px-2 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={phone}
              inputMode="tel"
              onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
              placeholder={t("Phone", "Telefon")}
              className="h-11 rounded-lg border border-black/15 px-2 text-sm"
            />
            <input
              value={email}
              onChange={(e) => setEmail(sanitizeEmailInput(e.target.value))}
              placeholder={t("Email", "E-post")}
              className="h-11 rounded-lg border border-black/15 px-2 text-sm"
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(sanitizeTextInput(e.target.value))}
            rows={2}
            placeholder={t("Anything else?", "Noe annet?")}
            className="rounded-lg border border-black/15 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onComplete}
            className="self-start inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
          >
            {t("Continue", "Fortsett")}
          </button>
        </div>
      ),
    },
  ];

  const finalStep: FinalStep = {
    render: ({ onBack }) =>
      submitResult ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <h4 className="text-lg font-semibold text-logoblue">{t("Request received!", "Forespørsel mottatt!")}</h4>
          <p className="text-sm text-black/60">
            {t(
              `Request #${submitResult.orderNumber} is with us — we'll email you a quote shortly.`,
              `Forespørsel #${submitResult.orderNumber} er mottatt — vi sender deg et tilbud på e-post om kort tid.`,
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <button
            type="button"
            onClick={onBack}
            className="self-start flex items-center gap-1.5 text-sm font-semibold text-logoblue transition hover:opacity-70"
          >
            <span aria-hidden="true">←</span>
            {t("Back", "Tilbake")}
          </button>

          <div>
            <h4 className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-logoblue">
              {t("Summary", "Oppsummering")}
            </h4>
            <div className="mt-3 flex flex-col gap-1 text-sm text-black/70">
              <div className="flex justify-between gap-4">
                <span>{t("Item", "Vare")}</span>
                <span className="text-right">{description || "—"}</span>
              </div>
              {photos.length > 0 && (
                <div className="flex justify-between gap-4">
                  <span>{t("Photos", "Bilder")}</span>
                  <span>{photos.length}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span>{t("From", "Fra")}</span>
                <span className="text-right">{pickupAddress || "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>{t("To", "Til")}</span>
                <span className="text-right">{deliveryAddress || "—"}</span>
              </div>
            </div>
          </div>

          <p className="rounded-lg bg-logoblue/5 p-3 text-sm text-black/60">
            {t(
              "There's no instant price for items like this — we'll review the details and email you a quote to confirm before anything is booked.",
              "Det finnes ingen øyeblikkelig pris for slike varer — vi går gjennom detaljene og sender deg et tilbud på e-post før noe bestilles.",
            )}
          </p>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="self-start inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
          >
            {submitLoading ? t("Sending…", "Sender…") : t("Request a quote", "Be om tilbud")}
          </button>
        </div>
      ),
  };

  return <SteppedModal sections={sections} finalStep={finalStep} onClose={onClose} />;
}
