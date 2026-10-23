"use client";

import { useState } from "react";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { CustomerType } from "@/lib/booking/pricing/websiteVat";
import { DocumentIcon, MailIcon, MessageIcon, PersonIcon, PhoneIcon } from "./orderDetailsIcons";
import { FieldLabel, fieldClass, inputClass } from "./formFieldStyles";
import {
  isValidEmail,
  isValidOrgNumber,
  sanitizeEmailInput,
  sanitizeOrgNumberInput,
  sanitizePhoneInput,
  sanitizeTextInput,
} from "@/lib/orders/websiteOrderValidation";


type Props = {
  locale: Locale;
  // A private customer gives their full name; a business its company name
  // and org number. Not given (moving / quote "My order" form): one generic
  // name field.
  customerType?: CustomerType | null;
  name: string;
  setName: (value: string) => void;
  orgNumber?: string;
  setOrgNumber?: (value: string) => void;
  // "My order" can't change the org number (shown read-only).
  orgNumberLocked?: boolean;
  phone: string;
  setPhone: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
};

export function ContactDetailsCard({
  locale,
  customerType,
  name,
  setName,
  orgNumber = "",
  setOrgNumber,
  orgNumberLocked = false,
  phone,
  setPhone,
  email,
  setEmail,
  notes,
  setNotes,
}: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);

  // Every required field here only glows red once the visitor has left it
  // (blurred) still empty/invalid — same pattern as PickupContactCard.
  const [touched, setTouched] = useState({ name: false, orgNumber: false, phone: false, email: false });
  const markTouched = (field: keyof typeof touched) => setTouched((prev) => ({ ...prev, [field]: true }));

  const isBusiness = customerType === "business";
  const nameLabel = isBusiness
    ? t("Company name", "Firmanavn")
    : customerType === "private"
      ? t("Full name", "Fullt navn")
      : t("Name / company", "Navn / firma");
  const namePlaceholder = isBusiness
    ? t("Company name", "Firmanavn")
    : customerType === "private"
      ? t("First and last name", "Fornavn og etternavn")
      : t("Your name or company", "Ditt navn eller firma");
  const nameError = touched.name && !name.trim();
  const trimmedOrgNumber = orgNumber.trim();
  const orgNumberMissing = touched.orgNumber && !trimmedOrgNumber;
  const orgNumberInvalid = touched.orgNumber && !!trimmedOrgNumber && !isValidOrgNumber(trimmedOrgNumber);
  const phoneError = touched.phone && !phone.trim();
  const trimmedEmail = email.trim();
  const emailMissing = touched.email && !trimmedEmail;
  const emailInvalid = touched.email && !!trimmedEmail && !isValidEmail(trimmedEmail);

  const emailField = (
    <label className="block">
      <FieldLabel icon={<MailIcon className="h-4 w-4" />}>{t("Email", "E-post")}</FieldLabel>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(sanitizeEmailInput(e.target.value))}
        onBlur={() => markTouched("email")}
        placeholder={t("your@email.com", "din@epost.no")}
        className={fieldClass(emailMissing || emailInvalid)}
      />
      {emailInvalid && (
        <p className="mt-1.5 text-xs text-red-500">
          {t("Enter a valid email address.", "Skriv inn en gyldig e-postadresse.")}
        </p>
      )}
    </label>
  );

  return (
    <div
      className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6"
      // Moving on from the whole card flags every required field at once,
      // so a visitor who tabs straight past an empty one still sees it glow
      // red (see PickupContactCard for the same pattern).
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setTouched({ name: true, orgNumber: true, phone: true, email: true });
        }
      }}
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black/5 text-logoblue">
          <PersonIcon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-black/85">{t("Your details", "Dine opplysninger")}</h3>
          <p className="text-sm text-black/50">
            {t(
              "So we know who to deliver to and how to reach you.",
              "Slik at vi vet hvem vi leverer til og hvordan vi når deg.",
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel icon={<PersonIcon className="h-4 w-4" />}>{nameLabel}</FieldLabel>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(sanitizeTextInput(e.target.value))}
              onBlur={() => markTouched("name")}
              placeholder={namePlaceholder}
              autoComplete={isBusiness ? "organization" : "name"}
              className={fieldClass(nameError)}
            />
          </label>
          {isBusiness && (
            <label className="block">
              <FieldLabel icon={<DocumentIcon className="h-4 w-4" />}>{t("Org. number", "Org.nr.")}</FieldLabel>
              <input
                type="text"
                inputMode="numeric"
                value={orgNumber}
                onChange={(e) => setOrgNumber?.(sanitizeOrgNumberInput(e.target.value))}
                onBlur={() => markTouched("orgNumber")}
                placeholder="123 456 789"
                readOnly={orgNumberLocked}
                className={`${fieldClass(!orgNumberLocked && (orgNumberMissing || orgNumberInvalid))}${orgNumberLocked ? " bg-black/5 text-black/50" : ""}`}
              />
              {!orgNumberLocked && orgNumberInvalid && (
                <p className="mt-1.5 text-xs text-red-500">
                  {t("Enter a valid 9-digit org number.", "Skriv inn et gyldig organisasjonsnummer (9 siffer).")}
                </p>
              )}
            </label>
          )}
          <label className="block">
            <FieldLabel icon={<PhoneIcon className="h-4 w-4" />}>{t("Phone", "Telefon")}</FieldLabel>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
              onBlur={() => markTouched("phone")}
              placeholder={t("Your phone number", "Ditt telefonnummer")}
              className={fieldClass(phoneError)}
            />
          </label>
          {isBusiness && emailField}
        </div>

        {!isBusiness && emailField}

        <label className="block">
          <FieldLabel icon={<MessageIcon className="h-4 w-4" />}>
            {t("Additional information", "Tilleggsinformasjon")}
          </FieldLabel>
          <textarea
            value={notes}
            onChange={(e) => setNotes(sanitizeTextInput(e.target.value))}
            rows={3}
            placeholder={t("Any details we should know about?", "Noe vi bør vite om?")}
            className={`${inputClass} h-auto resize-none py-2.5`}
          />
        </label>
      </div>
    </div>
  );
}
