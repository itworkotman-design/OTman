import type { Locale } from "./ServiceWindowContent";
import { TjenesterContent } from "./TjenesterContent";

// The services the homepage "Services" modal (ServiceRequestFlow) offers —
// the same list as the /tjenester page's "Type of job" dropdown
// (TjenesterContent.jobTypeOptions), so both stay in sync. Each gets a line
// icon (app/_components/site/BookingModal/services/serviceIcons.tsx). Not
// priced: a request lands as an unpriced website order that staff quote
// (app/api/site/service-request).

export const SERVICE_REQUEST_CUSTOM_CODE = "custom";
const CUSTOM_SERVICE_MAX_LENGTH = 200;

export type ServiceIconKey = "electrician" | "carpenter" | "plumber" | "garden" | "cleaning" | "it" | "custom";

// Keyed by jobTypeOptions' `value`; a service added there without an entry
// here still shows, with the custom icon.
const ICON_KEYS: Record<string, ServiceIconKey> = {
  "option-1": "electrician",
  "option-2": "carpenter",
  "option-3": "plumber",
  "option-4": "garden",
  "option-5": "cleaning",
  "option-6": "it",
  [SERVICE_REQUEST_CUSTOM_CODE]: "custom",
};

export type ServiceRequestOption = { code: string; iconKey: ServiceIconKey; labelEn: string; labelNo: string };

export const SERVICE_REQUEST_OPTIONS: ServiceRequestOption[] = TjenesterContent.jobTypeOptions.map((option) => ({
  code: option.value,
  iconKey: ICON_KEYS[option.value] ?? "custom",
  labelEn: option.label.en,
  labelNo: option.label.no,
}));

function findOption(code: string | null): ServiceRequestOption | null {
  return SERVICE_REQUEST_OPTIONS.find((o) => o.code === code) ?? null;
}

// Whether the service step is answered: a service picked, and for the custom
// one, what it is.
export function isServiceChoiceReady(code: string | null, customService: string): boolean {
  if (!findOption(code)) return false;
  return code !== SERVICE_REQUEST_CUSTOM_CODE || !!customService.trim();
}

function label(option: ServiceRequestOption, customService: string, locale: Locale): string {
  const base = locale === "no" ? option.labelNo : option.labelEn;
  return option.code === SERVICE_REQUEST_CUSTOM_CODE ? `${base} — ${customService.trim()}` : base;
}

// The picked service's name ("Custom service — Painter" for the custom one),
// or null when nothing valid is picked.
export function serviceRequestLabel(code: string | null, customService: string, locale: Locale): string | null {
  const option = findOption(code);
  return option ? label(option, customService, locale) : null;
}

export type ParsedServiceChoice =
  | { ok: true; code: string; customService: string; labelEn: string }
  | { ok: false; errors: Record<string, string> };

// Server-side check of a submitted service; `labelEn` is what staff see on
// the order.
export function parseServiceChoice(rawCode: unknown, rawCustom: unknown): ParsedServiceChoice {
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (!code) return { ok: false, errors: { serviceCode: "Required" } };
  const option = findOption(code);
  if (!option) return { ok: false, errors: { serviceCode: "Unknown service" } };
  if (code !== SERVICE_REQUEST_CUSTOM_CODE) return { ok: true, code, customService: "", labelEn: label(option, "", "en") };

  const customService = typeof rawCustom === "string" ? rawCustom.trim() : "";
  if (!customService) return { ok: false, errors: { customService: "Required" } };
  if (customService.length > CUSTOM_SERVICE_MAX_LENGTH) return { ok: false, errors: { customService: "Maximum 200 characters" } };
  return { ok: true, code, customService, labelEn: label(option, customService, "en") };
}
