import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { CustomerType } from "@/lib/booking/pricing/websiteVat";
import { serviceRequestLabel } from "@/lib/content/serviceRequestCatalog";
import { formatOrderDate } from "@/lib/orders/formatOrderDate";
import type { ReviewBlock, ReviewRow } from "../whiteGoods/orderReview";

// The services flow's review page (its final step), in the same block shape
// as the delivery and moving reviews so it renders through the same
// OrderReviewBlocks cards: each service with what needs doing, where, when,
// and the contact answers (with the customer's own comment). No prices — a
// service request is quoted by staff.

export type ServiceReviewInput = {
  customerType: CustomerType | null;
  services: { serviceCode: string; customService: string; jobDescription: string }[];
  address: string;
  preferredDate: string;
  timeWindow: string;
  contact: { name: string; phone: string; email: string; notes: string };
};

export function buildServiceReviewBlocks(locale: Locale, input: ServiceReviewInput): ReviewBlock[] {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  // Leaves out a row whose answer is blank, so optional fields don't show up empty.
  const present = (rows: [string, string | null | undefined][]): ReviewRow[] =>
    rows.filter((row): row is [string, string] => !!row[1]?.trim()).map(([label, value]) => ({ label, value }));
  const customerType =
    input.customerType === "business" ? t("Business", "Bedrift") : input.customerType === "private" ? t("Private", "Privat") : null;

  return [
    {
      kind: "details",
      title: input.services.length > 1 ? t("Services", "Tjenester") : t("Service", "Tjeneste"),
      rows: present([
        [t("Ordering as", "Bestiller som"), customerType],
        ...input.services.map(
          (service): [string, string] => [
            serviceRequestLabel(service.serviceCode, service.customService, locale) ?? t("Service", "Tjeneste"),
            service.jobDescription,
          ],
        ),
      ]),
    },
    {
      kind: "location",
      title: t("Where", "Hvor"),
      rows: present([[t("Address", "Adresse"), input.address]]),
    },
    {
      kind: "details",
      title: t("Timing", "Tidspunkt"),
      rows: present([
        [t("Preferred date", "Ønsket dato"), input.preferredDate && formatOrderDate(input.preferredDate, locale)],
        [t("Time window", "Tidsvindu"), input.timeWindow],
      ]),
    },
    {
      kind: "contact",
      title: t("Your details", "Dine opplysninger"),
      rows: present([
        [t("Name", "Navn"), input.contact.name],
        [t("Phone", "Telefon"), input.contact.phone],
        [t("Email", "E-post"), input.contact.email],
        [t("Comment", "Kommentar"), input.contact.notes],
      ]),
    },
  ];
}
