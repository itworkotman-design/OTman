"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ServiceModalProps = {
  service: string;
  onClose: () => void;
};

type FormData = {
  name: string;
  email: string;
  phone: string;
};

type FormErrors = Partial<Record<keyof FormData | "service", string>>;
type TouchedFields = Partial<Record<keyof FormData, boolean>>;

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
const PHONE_REGEX = /^[0-9+()\-\s]+$/;

export function ServiceModal({ service, onClose }: ServiceModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
  });

  const [touched, setTouched] = useState<TouchedFields>({});

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  const validate = (data: FormData, currentService: string): FormErrors => {
    const nextErrors: FormErrors = {};

    const name = data.name.trim();
    const email = data.email.trim();
    const phone = data.phone.trim();
    const safeService = currentService.trim();

    if (!name) {
      nextErrors.name = "Full name is required.";
    } else if (name.length < 2) {
      nextErrors.name = "Full name must be at least 2 characters.";
    } else if (name.length > 80) {
      nextErrors.name = "Full name must be 80 characters or less.";
    } else if (!NAME_REGEX.test(name)) {
      nextErrors.name = "Full name contains invalid characters.";
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

    if (!safeService) {
      nextErrors.service = "Service is required.";
    } else if (safeService.length > 100) {
      nextErrors.service = "Service is too long.";
    }

    return nextErrors;
  };

  const errors = useMemo(() => validate(formData, service), [formData, service]);
  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  const handleChange =
    (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const finalErrors = validate(formData, service);

    setTouched({
      name: true,
      email: true,
      phone: true,
    });

    if (Object.keys(finalErrors).length > 0) return;

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      service: service.trim(),
    };

    console.log("Service request payload:", payload);

    onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
    >
      <div className="customContainer bg-white w-full max-w-md relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <h2 className="text-logoblue text-2xl font-bold mb-1">Book a Service</h2>
        <p className="text-gray-500 text-sm mb-6">Fill in your details and we&apos;ll get back to you shortly.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-semibold text-textColor">
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              value={formData.name}
              onChange={handleChange("name")}
              onBlur={() => markTouched("name")}
              placeholder="Jane Doe"
              className="customInput focus:outline-none focus:ring-2 focus:ring-logoblue/40 focus:border-logoblue transition"
            />
            {touched.name && errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-semibold text-textColor">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={formData.email}
              onChange={handleChange("email")}
              onBlur={() => markTouched("email")}
              placeholder="jane@example.com"
              className="customInput focus:outline-none focus:ring-2 focus:ring-logoblue/40 focus:border-logoblue transition"
            />
            {touched.email && errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="phone" className="text-sm font-semibold text-textColor">
              Phone Number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              minLength={7}
              maxLength={20}
              autoComplete="tel"
              value={formData.phone}
              onChange={handleChange("phone")}
              onBlur={() => markTouched("phone")}
              placeholder="+1 234 567 8900"
              className="customInput focus:outline-none focus:ring-2 focus:ring-logoblue/40 focus:border-logoblue transition"
            />
            {touched.phone && errors.phone && <p className="text-sm text-red-600">{errors.phone}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="service" className="text-sm font-semibold text-textColor">
              Service
            </label>
            <input
              id="service"
              name="service"
              type="text"
              value={service}
              readOnly
              className="customInput bg-gray-50 text-gray-500 cursor-default focus:outline-none"
            />
            {errors.service && <p className="text-sm text-red-600">{errors.service}</p>}
          </div>

          <button
            type="submit"
            disabled={!isValid}
            className="mt-2 customButtonEnabled h-10 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Request
          </button>
        </form>
      </div>
    </div>
  );
}