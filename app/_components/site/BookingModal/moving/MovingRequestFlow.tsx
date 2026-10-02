"use client";

import { useEffect, useState } from "react";
import { SteppedModal, type FinalStep, type StepSection } from "../SteppedModal";
import { CustomerTypeStep } from "../whiteGoods/CustomerTypeStep";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import { transportTimeWindows } from "@/lib/content/TransportRequestConfig";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { getVatDisplayTotal, type CustomerType } from "@/lib/booking/pricing/vatDisplayTotal";
import type { MovingCatalogOption } from "@/lib/content/getMovingCatalog";
import { sanitizePhoneInput, sanitizeTextInput } from "@/lib/orders/websiteOrderValidation";

type Props = {
  locale: Locale;
  onClose: () => void;
};

const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatKr(n: number) {
  return `${Math.round(n).toLocaleString("nb-NO")} kr`;
}

export function MovingRequestFlow({ locale, onClose }: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);

  const [catalogOptions, setCatalogOptions] = useState<MovingCatalogOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/site/moving-request/catalog", { signal: controller.signal, cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setCatalogError(t("Could not load pricing", "Kunne ikke laste priser"));
          return;
        }
        setCatalogOptions(data.options ?? []);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setCatalogError(t("Could not load pricing", "Kunne ikke laste priser"));
        }
      } finally {
        setCatalogLoading(false);
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [sizeOptionCode, setSizeOptionCode] = useState<string | null>(null);

  const [preferredDate, setPreferredDate] = useState("");
  const [timeWindow, setTimeWindow] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Set once by the very first step ("customer-type", below) so the
  // size-tile prices shown on the very next step are already in the right
  // VAT mode — no toggle to change it again later, since asking twice
  // would be redundant. Still display-only (never affects actual pricing).
  // Starts `null` (unanswered) rather than defaulting to "private" so the
  // first step's tiles open with neither one highlighted —
  // getVatDisplayTotal already treats "private" as its own default
  // whenever this is null.
  const [customerType, setCustomerType] = useState<CustomerType | null>(null);

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{ orderNumber: string } | null>(null);

  const selectedOption = catalogOptions.find((o) => o.code === sizeOptionCode) ?? null;
  // customerPriceCents is the catalog price, stored/entered as what the
  // client actually pays (VAT-inclusive) — see getVatDisplayTotal.
  const clientTotal = selectedOption ? selectedOption.customerPriceCents / 100 : 0;
  const vatDisplay = getVatDisplayTotal({ total: clientTotal, customerType: customerType ?? undefined });

  const canContinueDetails = !!pickupAddress.trim() && !!deliveryAddress.trim() && !!sizeOptionCode;
  const canContinueTiming = !!preferredDate && !!timeWindow;
  const canSubmit =
    !!name.trim() &&
    PHONE_RE.test(phone.trim()) &&
    EMAIL_RE.test(email.trim()) &&
    !!sizeOptionCode &&
    !submitLoading;

  async function handleSubmit() {
    setSubmitLoading(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/site/moving-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupAddress,
          deliveryAddress,
          sizeOptionCode,
          preferredDate,
          timeWindow,
          name,
          phone,
          email,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSubmitError(
          t("Something went wrong. Please try again.", "Noe gikk galt. Prøv igjen."),
        );
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
      id: "customer-type",
      title: t("Are you ordering as a private person or a business?", "Bestiller du som privatperson eller bedrift?"),
      render: ({ onComplete }) => (
        <CustomerTypeStep
          locale={locale}
          value={customerType}
          onPick={(next) => {
            setCustomerType(next);
            onComplete();
          }}
        />
      ),
    },
    {
      id: "move-details",
      title: t("Where are you moving?", "Hvor skal du flytte?"),
      description: t(
        "Tell us the addresses and roughly how much needs to move.",
        "Fortell oss adressene og omtrent hvor mye som skal flyttes.",
      ),
      render: ({ onComplete }) => (
        <div className="flex flex-col gap-3">
          <AddressAutocompleteInput
            value={pickupAddress}
            onChange={(v) => setPickupAddress(sanitizeTextInput(v))}
            placeholder={t("Moving from (address)", "Flytter fra (adresse)")}
          />
          <AddressAutocompleteInput
            value={deliveryAddress}
            onChange={(v) => setDeliveryAddress(sanitizeTextInput(v))}
            placeholder={t("Moving to (address)", "Flytter til (adresse)")}
          />

          <p className="pt-1 text-xs font-semibold uppercase tracking-[0.18em] text-black/40">
            {t("Approximate size", "Omtrentlig størrelse")}
          </p>

          {catalogLoading && <p className="text-sm text-black/50">{t("Loading pricing…", "Laster priser…")}</p>}
          {catalogError && <p className="text-sm text-red-600">{catalogError}</p>}

          <div className="grid gap-2 sm:grid-cols-2">
            {catalogOptions.map((option) => {
              const active = sizeOptionCode === option.code;
              const optionVat = getVatDisplayTotal({
                total: option.customerPriceCents / 100,
                customerType: customerType ?? undefined,
              });
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => setSizeOptionCode(option.code)}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    active ? "border-logoblue bg-logoblue text-white" : "border-black/8 bg-white text-textColor"
                  }`}
                >
                  <span className="font-semibold">{locale === "no" ? option.labelNo : option.labelEn}</span>
                  <span className={active ? "text-white/90" : "text-black/50"}>{formatKr(optionVat.primaryAmount)}</span>
                </button>
              );
            })}
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
      id: "timing",
      title: t("When?", "Når?"),
      description: t(
        "Pick a preferred date and window — we'll confirm the exact time once your booking is approved.",
        "Velg en foretrukket dato og et tidsvindu — vi bekrefter eksakt tidspunkt når bestillingen er godkjent.",
      ),
      render: ({ onComplete }) => (
        <div className="flex flex-col gap-3">
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
            disabled={!canContinueTiming}
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
              onChange={(e) => setEmail(sanitizeTextInput(e.target.value))}
              placeholder={t("Email", "E-post")}
              className="h-11 rounded-lg border border-black/15 px-2 text-sm"
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(sanitizeTextInput(e.target.value))}
            rows={3}
            placeholder={t(
              "Anything else? Floors, lift access, particularly heavy or fragile items…",
              "Noe annet vi bør vite? Etasjer, heis, spesielt tunge eller skjøre gjenstander …",
            )}
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
              `Request #${submitResult.orderNumber} is with us — once it's approved we'll email you a link to pay and confirm.`,
              `Forespørsel #${submitResult.orderNumber} er mottatt — når den er godkjent sender vi deg en lenke for betaling og bekreftelse på e-post.`,
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
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-logoblue">
              {t("Summary", "Oppsummering")}
            </h4>
            <div className="mt-3 flex flex-col gap-1 text-sm text-black/70">
              <div className="flex justify-between gap-4">
                <span>{t("From", "Fra")}</span>
                <span className="text-right">{pickupAddress || "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>{t("To", "Til")}</span>
                <span className="text-right">{deliveryAddress || "—"}</span>
              </div>
              {selectedOption && (
                <div className="flex justify-between gap-4">
                  <span>{t("Approximate size", "Omtrentlig størrelse")}</span>
                  <span>{locale === "no" ? selectedOption.labelNo : selectedOption.labelEn}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span>{t("Date", "Dato")}</span>
                <span>
                  {preferredDate} · {timeWindow.replace(/:00/g, "")}
                </span>
              </div>
            </div>

            <div className="mt-4 border-t border-black/10 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-logoblue">{t("Total", "Totalt")}</span>
                <span className="text-lg font-semibold text-logoblue">{formatKr(vatDisplay.primaryAmount)}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-end">
                <span className="text-xs text-black/45">
                  {formatKr(vatDisplay.secondaryAmount)} {vatDisplay.primary === "incVat" ? t("ex. VAT", "eks. mva") : t("incl. VAT", "inkl. mva")}
                </span>
              </div>
            </div>
          </div>

          <p className="rounded-lg bg-logoblue/5 p-3 text-sm text-black/60">
            {t(
              "This price is based on the approximate size you selected — the final price is confirmed when we review your booking. You'll get a payment link by email once it's approved.",
              "Denne prisen er basert på den omtrentlige størrelsen du valgte — endelig pris bekreftes når vi har gått gjennom bestillingen. Du får en betalingslenke på e-post når den er godkjent.",
            )}
          </p>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="self-start inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
          >
            {submitLoading ? t("Sending…", "Sender…") : t("Submit booking", "Send bestilling")}
          </button>
        </div>
      ),
  };

  return <SteppedModal sections={sections} finalStep={finalStep} onClose={onClose} />;
}
