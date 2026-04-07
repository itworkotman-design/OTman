"use client";

import { useMemo, useState } from "react";
import { ManpowerRentalContent } from "@/lib/content/ManpowerRentalContent";

type Locale = "en" | "no";

type PageProps = {
  content: typeof ManpowerRentalContent;
  locale: Locale;
};

type FormData = {
  name: string;
  contact: string;
  jobType: string;
  description: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;
type TouchedFields = Partial<Record<keyof FormData, boolean>>;

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;

export default function ManpowerRentalPage({ content, locale }: PageProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    contact: "",
    jobType: "",
    description: "",
  });

  const [touched, setTouched] = useState<TouchedFields>({});

  const validate = (data: FormData): FormErrors => {
    const nextErrors: FormErrors = {};

    const name = data.name.trim();
    const contact = data.contact.trim();
    const jobType = data.jobType.trim();
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
      nextErrors.jobType = "Job type is required.";
    } else if (jobType.length < 2) {
      nextErrors.jobType = "Job type must be at least 2 characters.";
    } else if (jobType.length > 100) {
      nextErrors.jobType = "Job type must be 100 characters or less.";
    }

    if (!description) {
      nextErrors.description = "Description is required.";
    } else if (description.length < 10) {
      nextErrors.description = "Description must be at least 10 characters.";
    } else if (description.length > 1000) {
      nextErrors.description = "Description must be 1000 characters or less.";
    }

    return nextErrors;
  };

  const errors = useMemo(() => validate(formData), [formData]);
  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  const handleChange =
    (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));
    };

  const markTouched = (field: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const finalErrors = validate(formData);
    setTouched({
      name: true,
      contact: true,
      jobType: true,
      description: true,
    });

    if (Object.keys(finalErrors).length > 0) return;

    const payload = {
      name: formData.name.trim(),
      contact: formData.contact.trim(),
      jobType: formData.jobType.trim(),
      description: formData.description.trim(),
    };

  };

  return (
    <div className="my-8">
      <section className="mb-10">
        <div className="overflow-hidden">
          <div className="grid gap-10 md:grid-cols-2">
            <div className="flex flex-col justify-center">
              <h1 className="text-2xl lg:text-5xl font-semibold text-logoblue">{content.heroTitle[locale]}</h1>
              <p className="mt-5 text-black/50">{content.heroText[locale]}</p>
            </div>

            <div className="relative min-h-[320] overflow-hidden">
              <div className="relative flex h-full flex-col justify-between">
                <div className="grid grid-cols-2 gap-4">
                  {content.featureCards.map((card, index) => (
                    <div
                      key={index}
                      className={
                        card.highlighted
                          ? "rounded-3xl bg-logoblue p-5 text-white shadow-sm"
                          : "rounded-3xl p-5 shadow-sm"
                      }
                    >
                      <div className={card.highlighted ? "text-sm text-white" : "text-sm text-black/50"}>
                        {card.label[locale]}
                      </div>
                      <div
                        className={
                          card.highlighted
                            ? "mt-2 text-lg font-semibold"
                            : "mt-2 text-lg font-semibold text-textcolor"
                        }
                      >
                        {card.title[locale]}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {content.benefits[locale].map((item) => (
                      <div key={item} className="flex items-start gap-3 text-sm text-black/50">
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
              <div>
                <input
                  name="name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleChange("name")}
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
                <input
                  name="jobType"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={formData.jobType}
                  onChange={handleChange("jobType")}
                  onBlur={() => markTouched("jobType")}
                  className="rounded-2xl w-full bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50"
                  placeholder={content.formPlaceholders.jobType[locale]}
                />
                {touched.jobType && errors.jobType && <p className="mt-1 text-sm text-red-600">{errors.jobType}</p>}
              </div>

              <div>
                <textarea
                  name="description"
                  required
                  minLength={10}
                  maxLength={1000}
                  value={formData.description}
                  onChange={handleChange("description")}
                  onBlur={() => markTouched("description")}
                  className="min-h-[120] w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50"
                  placeholder={content.formPlaceholders.description[locale]}
                />
                {touched.description && errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                )}
              </div>

              <div className="mt-auto">
                <button
                  type="submit"
                  disabled={!isValid}
                  className="customButtonEnabled w-full h-12 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {content.submitButton[locale]}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}