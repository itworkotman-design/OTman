import { formatOrderDate } from "@/lib/orders/formatOrderDate";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { BookingCustomerType, BookingPickupStop } from "@/lib/orders/websiteBookingDetails";
import type { PickupSource } from "./PickupSourceStep";

// The text half of the white-goods review page (the modal's final step): the
// pickup(s), delivery and contact answers as labelled rows, so the customer
// can check everything before sending. Products and prices are shown by
// WhiteGoodsOrderSummary next to these.

// `copy`: the admin panel shows a copy button beside it (markCopyableRows).
export type ReviewRow = { label: string; value: string; copy?: boolean };
// "location" blocks (pickups, delivery, a move's two ends) get a location pin
// on the review page; "details" (a move's timing) and "contact" don't.
export type ReviewBlock = { kind: "location" | "details" | "contact"; title: string; rows: ReviewRow[] };

// The same stop shape that's stored on the order (Order.websiteBookingDetails),
// so the admin WebsiteOrderModal renders a saved order through these blocks too.
export type ReviewPickup = BookingPickupStop;

export type ReviewInput = {
  pickups: ReviewPickup[];
  delivery: { address: string; floor: number | null; liftAvailable: boolean };
  preferredDate: string;
  timeWindow: string;
  drivingDistance: string;
  contact: {
    name: string;
    phone: string;
    email: string;
    notes: string;
    // Labels the name "Full name" / "Company name"; a business adds its org number.
    customerType?: BookingCustomerType | null;
    orgNumber?: string;
  };
};

// "974760673" → "974 760 673", the way org numbers are usually written.
export function formatOrgNumber(orgNumber: string): string {
  const digits = orgNumber.replace(/\s/g, "");
  return /^\d{9}$/.test(digits) ? digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : orgNumber;
}

export function buildOrderReviewBlocks(locale: Locale, input: ReviewInput): ReviewBlock[] {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const sourceLabel: Record<PickupSource, string> = {
    store: t("Store", "Butikk"),
    private: t("Private individual", "Privatperson"),
    business: t("Business", "Bedrift"),
  };
  const floorValue = (floor: number | null, lift: boolean) =>
    floor === null ? null : `${floor} · ${lift ? t("with lift", "med heis") : t("no lift", "uten heis")}`;
  // Leaves out a row whose answer is blank, so optional fields don't show up empty.
  const present = (rows: [string, string | null | undefined][]): ReviewRow[] =>
    rows.filter((row): row is [string, string] => !!row[1]?.trim()).map(([label, value]) => ({ label, value }));

  const isBusiness = input.contact.customerType === "business";
  const nameLabel = isBusiness
    ? t("Company name", "Firmanavn")
    : input.contact.customerType === "private"
      ? t("Full name", "Fullt navn")
      : t("Name", "Navn");

  const numbered = input.pickups.length > 1;
  const pickupBlocks = input.pickups.map((pickup, i): ReviewBlock => ({
    kind: "location",
    title: numbered ? `${t("Pickup", "Henting")} ${i + 1}` : t("Pickup", "Henting"),
    rows: present([
      [t("Picked up from", "Hentes fra"), pickup.source ? sourceLabel[pickup.source] : null],
      [t("Place", "Sted"), pickup.placeName],
      [t("Address", "Adresse"), pickup.address],
      [t("Floor", "Etasje"), floorValue(pickup.floor, pickup.liftAvailable)],
      [t("Contact person", "Kontaktperson"), [pickup.contactName, pickup.contactPhone].filter((s) => s.trim()).join(", ")],
      [t("Products", "Varer"), pickup.productNames?.join(", ")],
    ]),
  }));

  return [
    ...pickupBlocks,
    {
      kind: "location",
      title: t("Delivery", "Levering"),
      rows: present([
        [t("Address", "Adresse"), input.delivery.address],
        [t("Floor", "Etasje"), floorValue(input.delivery.floor, input.delivery.liftAvailable)],
        [t("Preferred date", "Ønsket dato"), formatOrderDate(input.preferredDate, locale)],
        [t("Time window", "Tidsvindu"), input.timeWindow],
        [t("Driving distance", "Kjøreavstand"), input.drivingDistance.trim() ? `${input.drivingDistance} km` : null],
      ]),
    },
    {
      kind: "contact",
      title: t("Your details", "Dine opplysninger"),
      rows: present([
        [nameLabel, input.contact.name],
        [t("Org. no.", "Org.nr."), isBusiness && input.contact.orgNumber ? formatOrgNumber(input.contact.orgNumber) : null],
        [t("Phone", "Telefon"), input.contact.phone],
        [t("Email", "E-post"), input.contact.email],
        [t("Notes", "Merknader"), input.contact.notes],
      ]),
    },
  ];
}

// The admin panel's copy buttons, like the regular order modal's: every
// address (pickups, delivery, a move's two ends, a service's address) and the
// customer's phone. Every builder uses the same "Address"/"Phone" labels.
export function markCopyableRows(blocks: ReviewBlock[], locale: Locale): ReviewBlock[] {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const copyable = new Set([t("Address", "Adresse"), t("Phone", "Telefon")]);
  return blocks.map((block) => ({
    ...block,
    rows: block.rows.map((row) => (copyable.has(row.label) ? { ...row, copy: true } : row)),
  }));
}
