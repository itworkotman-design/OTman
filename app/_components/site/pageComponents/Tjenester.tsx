"use client";

import { useMemo, useRef, useState } from "react";
import { TjenesterContent } from "@/lib/content/TjenesterContent";

type Locale = "en" | "no";

type PageProps = {
  content: typeof TjenesterContent;
  locale: Locale;
};

type FormData = {
  name: string;
  contact: string;
  jobType: string;
  customService: string;
  description: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;
type TouchedFields = Partial<Record<keyof FormData, boolean>>;

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;

function sanitizeName(v: string) { return v.replace(/[^\p{L}\s'-]/gu, ""); }
function sanitizeLettersNumbers(v: string) { return v.replace(/[^\p{L}\p{N}\s]/gu, ""); }

function validate(data: FormData, locale: Locale): FormErrors {
  const nextErrors: FormErrors = {};

  const name = data.name.trim();
  const contact = data.contact.trim();
  const jobType = data.jobType.trim();
  const customService = data.customService.trim();
  const description = data.description.trim();

  if (!name) {
    nextErrors.name = "Name is required.";
  } else if (name.length < 2) {
    nextErrors.name = "Name must be at least 2 characters.";
  } else if (name.length > 80) {
    nextErrors.name = "Name must be 80 characters or less.";
  } else if (!NAME_REGEX.test(name)) {
    nextErrors.name = "Name contains invalid characters.";
  }

  if (!contact) {
    nextErrors.contact = "Contact information is required.";
  } else if (contact.length < 5) {
    nextErrors.contact = "Contact information is too short.";
  } else if (contact.length > 254) {
    nextErrors.contact = "Contact information is too long.";
  }

  if (!jobType) {
    nextErrors.jobType = locale === "no" ? "Velg en tjenestetype." : "Please select a service type.";
  } else if (jobType === "custom" && !customService) {
    nextErrors.customService = locale === "no" ? "Beskriv tjenesten du trenger." : "Please describe the service you need.";
  } else if (jobType === "custom" && customService.length > 200) {
    nextErrors.customService = locale === "no" ? "Maks 200 tegn." : "Maximum 200 characters.";
  }

  if (!description) {
    nextErrors.description = "Description is required.";
  } else if (description.length < 10) {
    nextErrors.description = "Description must be at least 10 characters.";
  } else if (description.length > 1000) {
    nextErrors.description = "Description must be 1000 characters or less.";
  }

  return nextErrors;
}

export default function Tjenester({ content, locale }: PageProps) {
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    contact: "",
    jobType: "",
    customService: "",
    description: "",
  });

  const [touched, setTouched] = useState<TouchedFields>({});
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);

  const errors = useMemo(() => validate(formData, locale), [formData, locale]);
  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  const handleChange =
    (field: keyof FormData, sanitize?: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const v = sanitize ? sanitize(e.target.value) : e.target.value;
      setFormData((prev) => ({ ...prev, [field]: v }));
    };

  const markTouched = (field: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();

    const finalErrors = validate(formData, locale);
    setTouched({ name: true, contact: true, jobType: true, customService: true, description: true });

    if (Object.keys(finalErrors).length > 0) return;

    setSubmitStatus("submitting");
    setSubmitError(null);

    try {
      const res = await fetch("/api/public/manpower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          contact: formData.contact.trim(),
          jobType: formData.jobType.trim(),
          customService: formData.jobType === "custom" ? formData.customService.trim() : "",
          description: formData.description.trim(),
          _hp: honeypotRef.current?.value ?? "",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { reason?: string };
        if (data.reason === "RATE_LIMIT_DAILY") {
          setSubmitError(
            locale === "no"
              ? "Vi har registrert et uvanlig høyt antall innkommende forespørsler og har midlertidig stanset skjemaet. Vennligst ta kontakt med oss direkte."
              : "We have detected an unusually high volume of incoming requests and have temporarily paused the form. Please reach out to us directly.",
          );
        } else if (data.reason === "RATE_LIMIT_MINUTE") {
          setSubmitError(locale === "no" ? "Vennligst vent litt før du sender inn igjen." : "Please wait a moment before submitting again.");
        } else {
          setSubmitError(locale === "no" ? "Noe gikk galt. Prøv igjen." : "Something went wrong. Please try again.");
        }
        setSubmitStatus("error");
        return;
      }

      setSubmitStatus("success");
      setFormData({ name: "", contact: "", jobType: "", customService: "", description: "" });
      setTouched({});
    } catch {
      setSubmitError(locale === "no" ? "Noe gikk galt. Prøv igjen." : "Something went wrong. Please try again.");
      setSubmitStatus("error");
    }
  };

  const toggleCard = (index: number) => {
    setActiveCardIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="my-8">
      <section className="mb-10">
        <div className="overflow-hidden">
          <div className="max-w-200 sm:text-center mx-auto mb-10">
            <h1 className="text-2xl lg:text-5xl font-semibold text-logoblue">{content.heroTitle[locale]}</h1>
            <p className="mt-5 text-black/50">{content.heroText[locale]}</p>
          </div>
          <div>
            <div className="relative overflow-hidden">
              <div className="relative flex h-full flex-col justify-between">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {content.featureCards.map((card, index) => {
                    const isActive = activeCardIndex === index;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleCard(index)}
                        className={`rounded-3xl bg-logoblue p-5 text-white shadow-sm text-left w-full transition-all duration-200 ${isActive ? "ring-2 ring-white/70 bg-logoblue/80" : "hover:bg-logoblue/90"}`}
                      >
                        <div className="text-sm text-white">{card.label[locale]}</div>
                        <div className="mt-2 text-lg font-semibold text-center">{card.title[locale]}</div>
                        <div className={`mt-3 flex justify-center transition-transform duration-200 ${isActive ? "rotate-180" : ""}`}>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {activeCardIndex !== null && (
                  <div className="mt-4 rounded-3xl bg-logoblue p-6 text-white animate-in fade-in slide-in-from-top-2 duration-200">
                    <h3 className="text-lg font-semibold mb-2">{content.featureCards[activeCardIndex].title[locale]}</h3>
                    <p className="text-sm leading-6 text-white/80">{content.featureCards[activeCardIndex].details[locale]}</p>
                  </div>
                )}

                <div className="mt-6">
                  <div className="grid gap-3 sm:grid-cols-4">
                    {content.benefits[locale].map((item) => (
                      <div key={item} className="flex items-start gap-3 text-sm text-black/50 sm:justify-self-center">
                        <span className="mt-0.5 inline-block h-2.5 w-2.5 rounded-full bg-lineSecondary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto">
        <div className="lg:grid grid-cols-2 gap-20">
          <div className="rounded-3xl mb-10 lg:mb-0 bg-logoblue py-4 px-8 text-white">
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">{content.processTitle[locale]}</h2>
            <div className="mt-8 space-y-5">
              {content.steps.map((step) => (
                <div key={step.number} className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/10">
                  <div className="text-sm font-semibold text-white/60 flex gap-10">
                    <p>{step.number}</p>
                    <h3 className="mt-1 text-lg font-semibold">{step.title[locale]}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/80">{step.text[locale]}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="customContainer mb-10 lg:mb-0 py-4! px-8! rounded-3xl! flex flex-col">
            <div>
              <h2 className="mt-3 text-3xl font-semibold text-logoblue">{content.formTitle[locale]}</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">{content.formText[locale]}</p>
            </div>

            <form className="mt-8 space-y-6 flex-col" onSubmit={handleSubmit} noValidate>
              <input
                type="text"
                name="_hp"
                aria-hidden="true"
                tabIndex={-1}
                autoComplete="off"
                ref={honeypotRef}
                defaultValue=""
                style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0, width: 0 }}
              />
              <div>
                <input
                  name="name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleChange("name", sanitizeName)}
                  onBlur={() => markTouched("name")}
                  className="rounded-2xl w-full custom bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50"
                  placeholder={content.formPlaceholders.name[locale]}
                />
                {touched.name && errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <input
                  name="contact"
                  type="text"
                  required
                  minLength={5}
                  maxLength={254}
                  autoComplete="email"
                  value={formData.contact}
                  onChange={handleChange("contact")}
                  onBlur={() => markTouched("contact")}
                  className="rounded-2xl w-full bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50"
                  placeholder={content.formPlaceholders.contact[locale]}
                />
                {touched.contact && errors.contact && <p className="mt-1 text-sm text-red-600">{errors.contact}</p>}
              </div>

              <div>
                <select
                  name="jobType"
                  required
                  value={formData.jobType}
                  onChange={(e) => {
                    handleChange("jobType")(e);
                    if (e.target.value !== "custom") {
                      setFormData((prev) => ({ ...prev, customService: "" }));
                    }
                  }}
                  onBlur={() => markTouched("jobType")}
                  className="rounded-2xl w-full bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50"
                >
                  <option value="">{locale === "no" ? "Velg tjenestetype" : "Select service type"}</option>
                  {content.jobTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label[locale]}</option>
                  ))}
                </select>
                {touched.jobType && errors.jobType && <p className="mt-1 text-sm text-red-600">{errors.jobType}</p>}
              </div>

              {formData.jobType === "custom" && (
                <div>
                  <input
                    name="customService"
                    type="text"
                    maxLength={200}
                    value={formData.customService}
                    onChange={handleChange("customService", sanitizeLettersNumbers)}
                    onBlur={() => markTouched("customService")}
                    className="rounded-2xl w-full bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50"
                    placeholder={locale === "no" ? "Beskriv tjenesten du trenger" : "Describe the service you need"}
                  />
                  {touched.customService && errors.customService && <p className="mt-1 text-sm text-red-600">{errors.customService}</p>}
                </div>
              )}

              <div>
                <textarea
                  name="description"
                  required
                  minLength={10}
                  maxLength={1000}
                  value={formData.description}
                  onChange={handleChange("description", sanitizeLettersNumbers)}
                  onBlur={() => markTouched("description")}
                  className="min-h-[120] w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50"
                  placeholder={content.formPlaceholders.description[locale]}
                />
                {touched.description && errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
              </div>

              {submitStatus === "success" && (
                <p className="text-sm text-green-600 text-center">{locale === "no" ? "Forespørselen ble sendt!" : "Request sent!"}</p>
              )}

              {submitStatus === "error" && submitError && (
                <p className="text-sm text-red-600 text-center">{submitError}</p>
              )}

              <div className="mt-auto">
                <button
                  type="submit"
                  disabled={!isValid || submitStatus === "submitting"}
                  className="customButtonEnabled w-full h-12 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitStatus === "submitting" ? (locale === "no" ? "Sender..." : "Sending...") : content.submitButton[locale]}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
