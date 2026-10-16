"use client";

import { useEffect, useState } from "react";
import CustomerOrderEditFooter from "@/app/_components/site/pageComponents/myOrder/CustomerOrderEditFooter";
import type { CustomerEditDraft, CustomerServiceDraft } from "@/app/_components/site/pageComponents/myOrder/customerEditPayload";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import { SteppedModal, type FinalStep, type StepSection } from "../SteppedModal";
import { CustomerTypeStep } from "../whiteGoods/CustomerTypeStep";
import { AutoAdvance } from "../AutoAdvance";
import { DateTimeWindowFields } from "../whiteGoods/DateTimeWindowFields";
import { OrderReviewBlocks } from "../whiteGoods/OrderReviewParts";
import { isTimeWindowComplete } from "@/lib/booking/timeWindows";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { CustomerType } from "@/lib/booking/pricing/websiteVat";
import {
  SERVICE_REQUEST_CUSTOM_CODE,
  SERVICE_REQUEST_OPTIONS,
  isServiceChoiceReady,
} from "@/lib/content/serviceRequestCatalog";
import {
  isValidEmail,
  sanitizeEmailInput,
  sanitizePhoneInput,
  sanitizeTextInput,
  validatePhoneField,
} from "@/lib/orders/websiteOrderValidation";
import { ServiceIcon } from "./serviceIcons";
import { buildServiceReviewBlocks } from "./serviceReview";

// The homepage "Services" card's modal — the same stepped flow as delivery
// (WhiteGoodsBookingFlow) and moving (MovingRequestFlow): private or business
// first, then which service (the /tjenester page's list, as icon tiles —
// lib/content/serviceRequestCatalog.ts) with what needs doing right under
// it, the address, when, and the contact details with an optional comment
// (its own thing, Order.customerComments). Not priced: it lands as an unpriced
// website order that staff quote (/api/site/service-request).

// The same flow, opened by the customer on their own request in "My order"
// (like MovingCustomerEdit): loaded from /api/customer/orders/[orderNumber]
// with every section open, saved through its PUT from the edit bar
// (CustomerOrderEditFooter). Within 24h of the job only the contact details
// and the job description are left. The quote is staff's — never shown here.

export type ServiceCustomerEdit = {
  orderNumber: string;
  beforeCutoff: boolean;
  onSaved: (message: string) => void;
};

type Props = {
  locale: Locale;
  onClose: () => void;
  customer?: ServiceCustomerEdit;
};

export function ServiceRequestFlow({ locale, onClose, customer }: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);

  const [customerType, setCustomerType] = useState<CustomerType | null>(null);

  const [serviceCode, setServiceCode] = useState<string | null>(null);
  const [customService, setCustomService] = useState("");
  // The custom service's text only counts once the customer leaves the field
  // (or presses Enter), so the next step doesn't open — and scroll — on the
  // first letter typed.
  const [customServiceCommitted, setCustomServiceCommitted] = useState(false);
  const isCustom = serviceCode === SERVICE_REQUEST_CUSTOM_CODE;
  const serviceReady = isServiceChoiceReady(serviceCode, customService) && (!isCustom || customServiceCommitted);

  const [address, setAddress] = useState("");
  // Picked from the autocomplete suggestions (not free-typed) — required to
  // move on, as in the delivery and moving modals. Every keystroke resets it.
  const [addressSelected, setAddressSelected] = useState(false);
  const [addressTouched, setAddressTouched] = useState(false);
  const addressNotSelected = addressTouched && !!address.trim() && !addressSelected;
  const addressReady = addressSelected && !!address.trim();

  const [preferredDate, setPreferredDate] = useState("");
  const [timeWindow, setTimeWindow] = useState("");
  const [timingTouched, setTimingTouched] = useState(false);
  const canContinueTiming = !!preferredDate && isTimeWindowComplete(timeWindow);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // What needs doing — asked with the service (part of the request), not
  // with the contact details. The next step opens as soon as there's text.
  const [jobDescription, setJobDescription] = useState("");
  const serviceStepReady = serviceReady && !!jobDescription.trim();
  // The customer's own comment, with their details — its own thing.
  const [notes, setNotes] = useState("");

  // "My order": the customer's own request, loaded into the flow's state.
  const customerLocked = !!customer && !customer.beforeCutoff;
  const [customerLoaded, setCustomerLoaded] = useState(!customer);
  const [customerLoadError, setCustomerLoadError] = useState(false);
  // The order as loaded — what the edit bar compares the flow with.
  const [customerInitialDraft, setCustomerInitialDraft] = useState<CustomerEditDraft | null>(null);
  const [customerSummaryOpen, setCustomerSummaryOpen] = useState(false);
  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/customer/orders/${encodeURIComponent(customer.orderNumber)}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        const details = data?.details;
        if (cancelled) return;
        if (!res.ok || !data?.ok || details?.kind !== "service") {
          setCustomerLoadError(true);
          return;
        }
        const service = details.service as CustomerServiceDraft;
        setServiceCode(service.serviceCode);
        setCustomService(service.customService);
        setCustomServiceCommitted(!!service.customService.trim());
        setAddress(service.address);
        setAddressSelected(true);
        setJobDescription(service.jobDescription);
        setPreferredDate(details.preferredDate);
        setTimeWindow(details.timeWindow);
        setName(details.customer.name);
        setPhone(details.customer.phone);
        setEmail(details.customer.email);
        setNotes(details.customer.comments);
        setCustomerType(details.customerType ?? "private");
        setCustomerInitialDraft({
          customer: details.customer,
          preferredDate: details.preferredDate,
          timeWindow: details.timeWindow,
          service,
        });
        setCustomerLoaded(true);
      } catch {
        if (!cancelled) setCustomerLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.orderNumber]);

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{ orderNumber: string } | null>(null);

  const canSubmit =
    !!customerType &&
    isServiceChoiceReady(serviceCode, customService) &&
    addressReady &&
    canContinueTiming &&
    !!name.trim() &&
    validatePhoneField(phone) === null &&
    isValidEmail(email) &&
    !!jobDescription.trim() &&
    !submitLoading;

  async function handleSubmit() {
    setSubmitLoading(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/site/service-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerType,
          serviceCode,
          customService: isCustom ? customService : "",
          address,
          jobDescription,
          preferredDate,
          timeWindow,
          name,
          phone,
          email,
          notes,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setSubmitError(
          data?.reason === "RATE_LIMIT_MINUTE"
            ? t("Please wait a moment before submitting again.", "Vennligst vent litt før du sender inn igjen.")
            : data?.reason === "RATE_LIMIT_DAILY"
              ? t(
                  "We've received an unusually high number of requests and have paused the form. Please contact us directly.",
                  "Vi har mottatt uvanlig mange forespørsler og har midlertidig stanset skjemaet. Vennligst ta kontakt med oss direkte.",
                )
              : t("Something went wrong. Please try again.", "Noe gikk galt. Prøv igjen."),
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
      id: "service",
      title: t("Which service do you need?", "Hvilken tjeneste trenger du?"),
      render: ({ onComplete, onUncomplete }) => (
        <div className="flex flex-col items-center gap-4">
          {/* Same icon tiles as the delivery modal's category picker (WebsiteListTiles). */}
          <div className="flex flex-wrap justify-center gap-3">
            {SERVICE_REQUEST_OPTIONS.map((option) => {
              const selected = serviceCode === option.code;
              return (
                <button
                  key={option.code}
                  type="button"
                  aria-pressed={selected}
                  // Within 24h of the job the service is locked (only the description can change).
                  disabled={customerLocked && !selected}
                  onClick={() => setServiceCode(option.code)}
                  className={[
                    "flex w-36 flex-col items-center gap-2 rounded-2xl border px-4 py-4 text-center transition disabled:opacity-40",
                    selected
                      ? "border-logoblue bg-logoblue/5"
                      : "border-black/10 hover:-translate-y-0.5 hover:border-logoblue/40 hover:shadow-md",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "grid h-14 w-14 place-items-center rounded-full",
                      selected ? "bg-logoblue text-white" : "bg-logoblue/10 text-logoblue",
                    ].join(" ")}
                  >
                    <ServiceIcon iconKey={option.iconKey} className="h-8 w-8" />
                  </span>
                  <span className={["text-sm font-semibold", selected ? "text-logoblue" : "text-black/80"].join(" ")}>
                    {locale === "no" ? option.labelNo : option.labelEn}
                  </span>
                </button>
              );
            })}
          </div>
          {isCustom && (
            <input
              value={customService}
              maxLength={200}
              autoFocus={!customer}
              disabled={customerLocked}
              onChange={(e) => {
                const next = sanitizeTextInput(e.target.value);
                setCustomService(next);
                if (!next.trim()) setCustomServiceCommitted(false);
              }}
              onBlur={() => setCustomServiceCommitted(!!customService.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter") setCustomServiceCommitted(!!customService.trim());
              }}
              placeholder={t("Which service do you need?", "Hvilken tjeneste trenger du?")}
              className="h-11 w-full max-w-md rounded-lg border border-black/15 px-3 text-sm"
            />
          )}
          {/* What needs doing — saved with the service, right under it. */}
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(sanitizeTextInput(e.target.value))}
            rows={4}
            maxLength={1000}
            placeholder={t(
              "What do you need done? The more detail, the more accurate the quote.",
              "Hva skal gjøres? Jo flere detaljer, jo mer presist tilbud.",
            )}
            className="w-full max-w-xl rounded-lg border border-black/15 px-3 py-2 text-sm"
          />
          <AutoAdvance
            ready={serviceStepReady}
            hold={isCustom && !!customService.trim()}
            onReady={onComplete}
            onRetract={onUncomplete}
          />
        </div>
      ),
    },
    {
      id: "address",
      title: t("Where should we come?", "Hvor skal vi komme?"),
      // Room for the address suggestions below the input.
      bottomSpace: true,
      render: ({ onComplete, onUncomplete }) => (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
          <AddressAutocompleteInput
            value={address}
            onChange={(v, wasSelected) => {
              setAddress(sanitizeTextInput(v));
              setAddressSelected(Boolean(wasSelected));
            }}
            locale={locale === "no" ? "nb" : "en"}
            placeholder={t("Address", "Adresse")}
            onBlur={() => setAddressTouched(true)}
            floating
            hasError={addressNotSelected}
          />
          {addressNotSelected && (
            <p className="-mt-1.5 text-xs text-red-500">
              {t("Please choose an address from the suggestions.", "Velg en adresse fra forslagene.")}
            </p>
          )}
          <AutoAdvance ready={addressReady} onReady={onComplete} onRetract={onUncomplete} />
        </div>
      ),
    },
    {
      id: "timing",
      title: t("When?", "Når?"),
      render: ({ onComplete, onUncomplete }) => (
        // Same card, date picker and time windows as the delivery and moving
        // modals — fields only turn red once focus has left the card with
        // them still unanswered.
        <div
          className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTimingTouched(true);
          }}
        >
          <DateTimeWindowFields
            locale={locale}
            preferredDate={preferredDate}
            setPreferredDate={setPreferredDate}
            timeWindow={timeWindow}
            setTimeWindow={setTimeWindow}
            dateError={timingTouched && !preferredDate}
            timeWindowError={timingTouched && !isTimeWindowComplete(timeWindow)}
          />
          <AutoAdvance ready={canContinueTiming} onReady={onComplete} onRetract={onUncomplete} />
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
              onChange={(e) => setEmail(sanitizeEmailInput(e.target.value))}
              placeholder={t("Email", "E-post")}
              className="h-11 rounded-lg border border-black/15 px-2 text-sm"
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(sanitizeTextInput(e.target.value))}
            rows={3}
            maxLength={2000}
            placeholder={t("Comment (optional)", "Kommentar (valgfritt)")}
            className="rounded-lg border border-black/15 px-2 py-1.5 text-sm"
          />
          {/* The one explicit button, as in the delivery and moving modals:
              moving on swaps the modal to the summary, so it mustn't fire
              while the email or comment is still being typed. "My order"
              saves from its edit bar instead. */}
          {!customer && (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={onComplete}
              className="self-center inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
            >
              {t("Go to summary", "Gå til oppsummering")}
            </button>
          )}
        </div>
      ),
    },
  ];

  const reviewBlocks = buildServiceReviewBlocks(locale, {
    customerType,
    serviceCode,
    customService,
    address,
    jobDescription,
    preferredDate,
    timeWindow,
    contact: { name, phone, email, notes },
  });

  const finalStep: FinalStep = {
    render: ({ onBack }) =>
      submitResult ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <h4 className="text-lg font-semibold text-logoblue">{t("Request received!", "Forespørsel mottatt!")}</h4>
          <p className="text-sm text-black/60">
            {t(
              `Request #${submitResult.orderNumber} is with us — we'll email you a quote and a link to confirm.`,
              `Forespørsel #${submitResult.orderNumber} er mottatt — vi sender deg et tilbud og en lenke for bekreftelse på e-post.`,
            )}
          </p>
        </div>
      ) : (
        // Same layout as the delivery and moving review pages: the answers as
        // cards on the left; no price on the right, since staff quote it.
        <div className="flex flex-col gap-6">
          <button
            type="button"
            onClick={onBack}
            className="self-start flex items-center gap-1.5 text-sm font-semibold text-logoblue transition hover:opacity-70"
          >
            <span aria-hidden="true">←</span>
            {t("Back", "Tilbake")}
          </button>

          <h4 className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-logoblue">
            {t("Summary", "Oppsummering")}
          </h4>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
            <div className="flex flex-col gap-4">
              <OrderReviewBlocks blocks={reviewBlocks} />
            </div>

            {/* "My order" saves from its edit bar (CustomerOrderEditFooter). */}
            {!customer && (
            <div className="flex flex-col gap-4 lg:self-start">
              <div className="rounded-2xl border border-black/10 bg-white p-6">
                <h3 className="text-base font-semibold text-logoblue">{t("Price", "Pris")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-black/60">
                  {t(
                    "We'll review your request and email you a quote. Nothing is charged until you've accepted it.",
                    "Vi går gjennom forespørselen og sender deg et tilbud på e-post. Ingenting belastes før du har godtatt det.",
                  )}
                </p>
              </div>

              {submitError && <p className="text-sm text-red-600">{submitError}</p>}

              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
              >
                {submitLoading ? t("Sending…", "Sender…") : t("Send request", "Send forespørsel")}
              </button>
            </div>
            )}
          </div>
        </div>
      ),
  };

  if (customer) {
    // Everything but the customer type (answered at booking); within 24h of
    // the job only the job description (under its locked service) and the
    // details (contact, comment).
    const customerSections = customerLocked
      ? sections.filter((section) => section.id === "service" || section.id === "your-details")
      : sections.filter((section) => section.id !== "customer-type");
    const loadingSections: StepSection[] = [
      {
        id: "customer-loading",
        title: customerLoadError ? t("Couldn't load the order", "Kunne ikke laste bestillingen") : t("Loading order…", "Laster bestilling…"),
        render: () => null,
      },
    ];
    const customerDraft: CustomerEditDraft = {
      customer: { name, phone, email, comments: notes },
      preferredDate,
      timeWindow,
      service: { serviceCode: serviceCode ?? "", customService: isCustom ? customService : "", jobDescription, address },
    };
    // A typed address must be picked from the suggestions before saving, as when booking.
    const blockedMessage = !jobDescription.trim()
      ? t("Describe what needs doing.", "Beskriv hva som skal gjøres.")
      : !customerLocked && !isServiceChoiceReady(serviceCode, customService)
        ? t("Choose a service.", "Velg en tjeneste.")
        : !customerLocked && !addressReady
          ? t("Please choose an address from the suggestions.", "Velg en adresse fra forslagene.")
          : null;
    return (
      <SteppedModal
        showAll
        sections={customerLoaded ? customerSections : loadingSections}
        finalStep={finalStep}
        finalStepOpen={!customerLocked && customerSummaryOpen}
        onFinalStepBack={() => setCustomerSummaryOpen(false)}
        onClose={onClose}
        title={
          <span className="truncate text-base font-semibold text-logoblue">
            {t("Change order", "Endre bestilling")} #{customer.orderNumber}
          </span>
        }
        footer={
          customerLoaded && customerInitialDraft ? (
            <CustomerOrderEditFooter
              orderNumber={customer.orderNumber}
              initial={customerInitialDraft}
              current={customerDraft}
              beforeCutoff={customer.beforeCutoff}
              locale={locale}
              onCancel={onClose}
              onSaved={customer.onSaved}
              blockedMessage={blockedMessage}
              summaryOpen={customerSummaryOpen}
              onOpenSummary={() => setCustomerSummaryOpen(true)}
            />
          ) : null
        }
      />
    );
  }

  return <SteppedModal sections={sections} finalStep={finalStep} onClose={onClose} dimCompleted scrollToNewSections />;
}
