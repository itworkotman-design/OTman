import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { MovingCatalogOption } from "@/lib/content/getMovingCatalog";
import { formatOrderDate } from "@/lib/orders/formatOrderDate";
import {
  MOVING_HOME_TYPES,
  MOVING_PARKING_OPTIONS,
  movingLiftApplies,
  type MovingPropertyDraft,
} from "@/lib/orders/movingProperty";
import type { ReviewBlock, ReviewRow } from "../whiteGoods/orderReview";
import { floorsLabel } from "./PropertySection";

// The text half of the moving flow's review page (its final step), in the
// delivery review's block shape (buildOrderReviewBlocks) so both render
// through the same OrderReviewBlocks cards: one block per end of the move,
// the timing, and the contact answers. Prices are shown by the order-summary
// card beside these.

export type MovingReviewInput = {
  pickupAddress: string;
  deliveryAddress: string;
  origin: MovingPropertyDraft;
  destination: MovingPropertyDraft;
  sizeOptions: MovingCatalogOption[];
  preferredDate: string;
  timeWindow: string;
  drivingDistance: string;
  contact: { name: string; phone: string; email: string; notes: string };
};

export function buildMovingReviewBlocks(locale: Locale, input: MovingReviewInput): ReviewBlock[] {
  const no = locale === "no";
  const t = (en: string, nb: string) => (no ? nb : en);
  // Leaves out a row whose answer is blank, so optional fields don't show up empty.
  const present = (rows: [string, string | null | undefined][]): ReviewRow[] =>
    rows.filter((row): row is [string, string] => !!row[1]?.trim()).map(([label, value]) => ({ label, value }));

  const end = (title: string, address: string, property: MovingPropertyDraft): ReviewBlock => {
    const homeType = MOVING_HOME_TYPES.find((h) => h.code === property.homeType);
    const size = input.sizeOptions.find((o) => o.code === property.sizeOptionCode);
    const parking = MOVING_PARKING_OPTIONS.find((p) => p.code === property.parking);
    // Apartments/offices: which floor, plus the lift when answered (it's
    // optional on the ground floor).
    const floor =
      movingLiftApplies(property.homeType) && property.floorNumber !== null
        ? [
            String(property.floorNumber),
            property.hasLift === null ? null : property.hasLift ? t("with lift", "med heis") : t("no lift", "uten heis"),
          ]
            .filter(Boolean)
            .join(" · ")
        : null;
    return {
      kind: "location",
      title,
      rows: present([
        [t("Address", "Adresse"), address],
        [t("Property type", "Boligtype"), homeType && (no ? homeType.labelNo : homeType.labelEn)],
        [t("Size", "Størrelse"), size && (no ? size.labelNo : size.labelEn)],
        [t("Number of floors", "Antall etasjer"), floorsLabel(locale, property.floors)],
        [t("Floor", "Etasje"), floor],
        [t("Parking", "Parkering"), parking && (no ? parking.labelNo : parking.labelEn)],
      ]),
    };
  };

  return [
    end(t("Moving from", "Flytter fra"), input.pickupAddress, input.origin),
    end(t("Moving to", "Flytter til"), input.deliveryAddress, input.destination),
    {
      kind: "details",
      title: t("Timing", "Tidspunkt"),
      rows: present([
        [t("Preferred date", "Ønsket dato"), input.preferredDate && formatOrderDate(input.preferredDate, locale)],
        [t("Time window", "Tidsvindu"), input.timeWindow],
        [t("Driving distance", "Kjøreavstand"), input.drivingDistance.trim() ? `${input.drivingDistance} km` : null],
      ]),
    },
    {
      kind: "contact",
      title: t("Your details", "Dine opplysninger"),
      rows: present([
        [t("Name", "Navn"), input.contact.name],
        [t("Phone", "Telefon"), input.contact.phone],
        [t("Email", "E-post"), input.contact.email],
        [t("Notes", "Merknader"), input.contact.notes],
      ]),
    },
  ];
}
