"use client";

import { useMemo, useState } from "react";
import GoogleMap from "@/app/_components/site/GoogleMap";
import { ContactContent } from "@/lib/content/ContactContent";

type Locale = "en" | "no";
type PageProps = {
  content: typeof ContactContent;
  locale: Locale;
};

type FormData = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;
type TouchedFields = Partial<Record<keyof FormData, boolean>>;

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
const PHONE_REGEX = /^[0-9+()\-\s]+$/;

export default function ContactPage({ content, locale }: PageProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const [touched, setTouched] = useState<TouchedFields>({});

  const validate = (data: FormData): FormErrors => {
    const nextErrors: FormErrors = {};

    const name = data.name.trim();
    const email = data.email.trim();
    const phone = data.phone.trim();
    const message = data.message.trim();

    if (!name) {
      nextErrors.name = "Name is required.";
    } else if (name.length < 2) {
      nextErrors.name = "Name must be at least 2 characters.";
    } else if (name.length > 80) {
      nextErrors.name = "Name must be 80 characters or less.";
    } else if (!NAME_REGEX.test(name)) {
      nextErrors.name = "Name contains invalid characters.";
    }

    if (!email) {
      nextErrors.email = "Email is required.";
    } else if (email.length > 254) {
      nextErrors.email = "Email is too long.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (phone) {
      if (phone.length < 7 || phone.length > 20) {
        nextErrors.phone = "Phone number must be 7 to 20 characters.";
      } else if (!PHONE_REGEX.test(phone)) {
        nextErrors.phone = "Phone number contains invalid characters.";
      }
    }

    if (!message) {
      nextErrors.message = "Message is required.";
    } else if (message.length < 10) {
      nextErrors.message = "Message must be at least 10 characters.";
    } else if (message.length > 1000) {
      nextErrors.message = "Message must be 1000 characters or less.";
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
      email: true,
      phone: true,
      message: true,
    });

    if (Object.keys(finalErrors).length > 0) return;

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      message: formData.message.trim(),
    };

    console.log("Contact form payload:", payload);
  };

  return (
    <>
      <div className="lg:flex pt-20 gap-10 items-center w-full">
        <div className="text-lg text-logoblue font-semibold w-[340] mx-auto lg:w-full flex-1 flex flex-col justify-center mb-10 lg:mb-0">
          <h1 className="text-4xl lg:text-6xl mb-8 text-center">{content.pageTitle[locale]}</h1>
          <div className="lg:pl-30">
            <div className="flex gap-4 mb-6 text-md lg:text-xl">
              <svg
                className="w-8 h-8"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M7.978 4a2.553 2.553 0 0 0-1.926.877C4.233 6.7 3.699 8.751 4.153 10.814c.44 1.995 1.778 3.893 3.456 5.572 1.68 1.679 3.577 3.018 5.57 3.459 2.062.456 4.115-.073 5.94-1.885a2.556 2.556 0 0 0 .001-3.861l-1.21-1.21a2.689 2.689 0 0 0-3.802 0l-.617.618a.806.806 0 0 1-1.14 0l-1.854-1.855a.807.807 0 0 1 0-1.14l.618-.62a2.692 2.692 0 0 0 0-3.803l-1.21-1.211A2.555 2.555 0 0 0 7.978 4Z" />
              </svg>
              <p>{content.contactInfo.phone.value}</p>
            </div>

            <div className="flex gap-4 mb-6 text-md lg:text-xl">
              <svg
                className="w-8 h-8"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M2.038 5.61A2.01 2.01 0 0 0 2 6v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6c0-.12-.01-.238-.03-.352l-.866.65-7.89 6.032a2 2 0 0 1-2.429 0L2.884 6.288l-.846-.677Z" />
                <path d="M20.677 4.117A1.996 1.996 0 0 0 20 4H4c-.225 0-.44.037-.642.105l.758.607L12 10.742 19.9 4.7l.777-.583Z" />
              </svg>
              <p>{content.contactInfo.email.value}</p>
            </div>

            <div className="flex gap-4 mb-6 text-md lg:text-xl">
              <svg
                className="w-8 h-8"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  fillRule="evenodd"
                  d="M11.906 1.994a8.002 8.002 0 0 1 8.09 8.421 7.996 7.996 0 0 1-1.297 3.957.996.996 0 0 1-.133.204l-.108.129c-.178.243-.37.477-.573.699l-5.112 6.224a1 1 0 0 1-1.545 0L5.982 15.26l-.002-.002a18.146 18.146 0 0 1-.309-.38l-.133-.163a.999.999 0 0 1-.13-.202 7.995 7.995 0 0 1 6.498-12.518ZM15 9.997a3 3 0 1 1-5.999 0 3 3 0 0 1 5.999 0Z"
                  clipRule="evenodd"
                />
              </svg>
              <p>{content.contactInfo.address.value}</p>
            </div>
          </div>
        </div>

        <div className="w-full lg:flex-1 flex flex-col justify-center">
          <form onSubmit={handleSubmit} noValidate>
            <div className="bg-logoblue rounded-2xl p-6 max-w-[480] mx-auto">
              <h1 className="text-center text-white text-2xl pb-2">{content.form.title[locale]}</h1>

              <div className="mb-4">
                <label className="block pb-1 text-lg text-white font-semibold" htmlFor="contact-name">
                  {content.form.fields.name.label[locale]}
                </label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleChange("name")}
                  onBlur={() => markTouched("name")}
                  placeholder={content.form.fields.name.placeholder[locale]}
                  className="customInput bg-white w-full"
                />
                {touched.name && errors.name && <p className="mt-1 text-sm text-red-200">{errors.name}</p>}
              </div>

              <div className="mb-4">
                <label className="block pb-1 text-lg text-white font-semibold" htmlFor="contact-email">
                  {content.form.fields.email.label[locale]}
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange("email")}
                  onBlur={() => markTouched("email")}
                  placeholder={content.form.fields.email.placeholder[locale]}
                  className="customInput bg-white w-full"
                />
                {touched.email && errors.email && <p className="mt-1 text-sm text-red-200">{errors.email}</p>}
              </div>

              <div className="mb-4">
                <label className="block pb-1 text-lg text-white font-semibold" htmlFor="contact-phone">
                  {content.form.fields.phone.label[locale]}
                </label>
                <input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  minLength={7}
                  maxLength={20}
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={handleChange("phone")}
                  onBlur={() => markTouched("phone")}
                  placeholder={content.form.fields.phone.placeholder[locale]}
                  className="customInput bg-white w-full"
                />
                {touched.phone && errors.phone && <p className="mt-1 text-sm text-red-200">{errors.phone}</p>}
              </div>

              <div>
                <label className="block pb-1 text-lg text-white font-semibold" htmlFor="contact-message">
                  {content.form.fields.message.label[locale]}
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  minLength={10}
                  maxLength={1000}
                  value={formData.message}
                  onChange={handleChange("message")}
                  onBlur={() => markTouched("message")}
                  placeholder={content.form.fields.message.placeholder[locale]}
                  className="customInput bg-white w-full h-30"
                />
                {touched.message && errors.message && <p className="mt-1 text-sm text-red-200">{errors.message}</p>}
              </div>

              <div className="flex pt-4">
                <button
                  type="submit"
                  disabled={!isValid}
                  className="customButtonEnabled bg-white! text-logoblue! font-semibold! w-full max-w-[400] mx-auto h-10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {content.form.submitButton[locale]}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <section className="my-20">
        <h2 className="text-center text-4xl font-semibold text-logoblue mb-8">{content.mapTitle[locale]}</h2>

        <div className="w-full h-[400] rounded-2xl overflow-hidden">
          <GoogleMap />
        </div>
      </section>
    </>
  );
}