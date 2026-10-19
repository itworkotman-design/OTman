"use client";

import { useEffect, useRef, useState } from "react";
import CustomerOrderEditFooter from "@/app/_components/site/pageComponents/myOrder/CustomerOrderEditFooter";
import type {
  CustomerEditDraft,
  CustomerServiceDraft,
  CustomerServiceItemDraft,
} from "@/app/_components/site/pageComponents/myOrder/customerEditPayload";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import { AnimatedStack, SteppedModal, TRANSITION_MS, type FinalStep, type StepSection } from "../SteppedModal";
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
// first, then which services — one or more (the /tjenester page's list, as
// icon tiles — lib/content/serviceRequestCatalog.ts) with what needs doing
// for each right under them, the address, when, and the contact details with an optional comment
// (its own thing, Order.customerComments). Not priced: it lands as an unpriced
// website order that staff quote (/api/site/service-request).

// The same flow, opened by the customer on their own request in "My order"
// (like MovingCustomerEdit): loaded from /api/customer/orders/[orderNumber]
// with every section open, saved through its PUT from the edit bar
// (CustomerOrderEditFooter). Only offered until 24h before the job — after
// that a service request can't be changed at all (customerOrderEditPolicy).
// The quotes are staff's — never shown here.

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

  // The services picked (as many as needed, in the order picked), each with
  // what needs doing for it — asked right under the tiles, as part of the
  // request, not with the contact details. The next step opens as soon as
  // every picked service is described (and a custom one named).
  const [services, setServices] = useState<CustomerServiceItemDraft[]>([]);
  const servicesReady =
    services.length > 0 &&
    services.every((service) => isServiceChoiceReady(service.serviceCode, service.customService) && !!service.jobDescription.trim());
  const updateService = (serviceCode: string, patch: Partial<CustomerServiceItemDraft>) =>
    setServices((list) => list.map((service) => (service.serviceCode === serviceCode ? { ...service, ...patch } : service)));
  // A just-picked service's description box animates open (AnimatedStack),
  // then the modal body smoothly scrolls down to it and focuses its first
  // field — not before, or the focus would jump the scroll mid-animation.
  const justAddedServiceRef = useRef<string | null>(null);
  const toggleService = (serviceCode: string) => {
    const adding = !services.some((service) => service.serviceCode === serviceCode);
    justAddedServiceRef.current = adding ? serviceCode : null;
    setServices((list) =>
      list.some((service) => service.serviceCode === serviceCode)
        ? list.filter((service) => service.serviceCode !== serviceCode)
        : [...list, { serviceCode, customService: "", jobDescription: "" }],
    );
  };
  useEffect(() => {
    const serviceCode = justAddedServiceRef.current;
    if (!serviceCode) return;
    justAddedServiceRef.current = null;
    const timer = window.setTimeout(() => {
      const box = document.querySelector<HTMLElement>(`[data-service-description="${CSS.escape(serviceCode)}"]`);
      if (!box) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      box.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
      box.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true });
    }, TRANSITION_MS + 50);
    return () => window.clearTimeout(timer);
  }, [services]);

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
  // The customer's own comment, with their details — its own thing.
  const [notes, setNotes] = useState("");

  // "My order": the customer's own request, loaded into the flow's state.
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
        setServices(service.services);
        setAddress(service.address);
        setAddressSelected(true);
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
    servicesReady &&
    addressReady &&
    canContinueTiming &&
    !!name.trim() &&
    validatePhoneField(phone) === null &&
    isValidEmail(email) &&
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
          services,
          address,
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
      title: t("Which services do you need?", "Hvilke tjenester trenger du?"),
      render: ({ onComplete, onUncomplete }) => (
        <div className="flex flex-col items-center gap-4">
          <p className="-mt-2 text-sm text-black/50">{t("Pick one or more.", "Velg én eller flere.")}</p>
          {/* Same icon tiles as the delivery modal's category picker
              (WebsiteListTiles); each one toggles its service. */}
          <div className="flex flex-wrap justify-center gap-3">
            {SERVICE_REQUEST_OPTIONS.map((option) => {
              const selected = services.some((service) => service.serviceCode === option.code);
              return (
                <button
                  key={option.code}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleService(option.code)}
                  className={[
                    "relative flex w-36 flex-col items-center gap-2 rounded-2xl border px-4 py-4 text-center transition",
                    selected
                      ? "border-logoblue bg-logoblue/5"
                      : "border-black/10 hover:-translate-y-0.5 hover:border-logoblue/40 hover:shadow-md",
                  ].join(" ")}
                >
                  {selected && (
                    <span aria-hidden="true" className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-logoblue text-xs text-white">
                      ✓
                    </span>
                  )}
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

          {/* What needs doing — one box per picked service, right under the
              tiles, saved with that service. */}
          <AnimatedStack
            gap={16}
            className="w-full max-w-xl"
            items={services.map((service) => {
              const option = SERVICE_REQUEST_OPTIONS.find((o) => o.code === service.serviceCode);
              const isCustom = service.serviceCode === SERVICE_REQUEST_CUSTOM_CODE;
              return {
                key: service.serviceCode,
                node: (
                  <div data-service-description={service.serviceCode} className="flex w-full flex-col gap-2 rounded-2xl border border-black/10 bg-white p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-logoblue">
                      <ServiceIcon iconKey={option?.iconKey ?? "custom"} className="h-5 w-5" />
                      {option ? (locale === "no" ? option.labelNo : option.labelEn) : service.serviceCode}
                    </div>
                    {isCustom && (
                      <input
                        value={service.customService}
                        maxLength={200}
                        onChange={(e) => updateService(service.serviceCode, { customService: sanitizeTextInput(e.target.value) })}
                        placeholder={t("Which service do you need?", "Hvilken tjeneste trenger du?")}
                        className="h-11 w-full rounded-lg border border-black/15 px-3 text-sm"
                      />
                    )}
                    <textarea
                      value={service.jobDescription}
                      onChange={(e) => updateService(service.serviceCode, { jobDescription: sanitizeTextInput(e.target.value) })}
                      rows={3}
                      maxLength={1000}
                      placeholder={t(
                        "What do you need done? The more detail, the more accurate the quote.",
                        "Hva skal gjøres? Jo flere detaljer, jo mer presist tilbud.",
                      )}
                      className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                    />
                  </div>
                ),
              };
            })}
          />
          {/* Held while any service is picked, so adding another (not yet
              described) doesn't fold the steps already opened below. */}
          <AutoAdvance ready={servicesReady} hold={services.length > 0} onReady={onComplete} onRetract={onUncomplete} />
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
    services,
    address,
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
            {/* All the answers in one card, sections split by a line (as in the admin modal). */}
            <div className="divide-y divide-black/10 rounded-2xl border border-black/10 bg-white lg:self-start">
              <OrderReviewBlocks blocks={reviewBlocks} bare />
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
    // Everything but the customer type (answered at booking).
    const customerSections = sections.filter((section) => section.id !== "customer-type");
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
      service: { address, services },
    };
    // A typed address must be picked from the suggestions before saving, as when booking.
    const blockedMessage =
      services.length === 0
        ? t("Choose at least one service.", "Velg minst én tjeneste.")
        : !servicesReady
          ? t("Describe what needs doing for every service.", "Beskriv hva som skal gjøres for hver tjeneste.")
          : !addressReady
          ? t("Please choose an address from the suggestions.", "Velg en adresse fra forslagene.")
          : null;
    return (
      <SteppedModal
        showAll
        sections={customerLoaded ? customerSections : loadingSections}
        finalStep={finalStep}
        finalStepOpen={customerSummaryOpen}
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
