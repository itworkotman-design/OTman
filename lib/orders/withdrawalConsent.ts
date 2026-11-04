import type { BookingCustomerType } from "./websiteBookingDetails";

// The right of withdrawal (angrerettloven) on homepage orders. Transporting
// goods on an agreed date has none (§ 22 m), but a service — installing,
// disconnecting, dismantling, packing, cleaning — has 14 days. A job done
// inside those 14 days can still be withdrawn from at no cost unless the
// customer asked for it to be done within the period and accepted that the
// right lapses once it's fully done (§ 22 a, § 24). That request is the
// checkbox on the booking summary; the order keeps when it was ticked
// (websiteBookingDetails / movingBookingDetails: withdrawalConsentAt) and
// the order confirmation repeats it (§ 19).

export const WITHDRAWAL_CONSENT_TEXT = {
  no: "Jeg ber om at tjenestene utføres innen angrefristen på 14 dager, og er kjent med at angreretten faller bort når tjenesten er fullført. Avbryter jeg før det, betaler jeg for det som er utført.",
  en: "I ask for the services to be carried out within the 14-day withdrawal period, and understand that the right of withdrawal lapses once the service is completed. If I withdraw before then, I pay for the work already done.",
} as const;

// Extras that are work on the item rather than moving it. Unpacking, taking
// the pallet and taking the old item away stay part of the transport.
const SERVICE_EXTRA_CODES = new Set(["WALL_ANCHORING", "DISMANTLE_DISP_STD", "DISMANTLE_CAR_STD"]);

type ServiceCard = {
  productId: string | null;
  selectedInstallOptionIds: string[];
  selectedExtraOptionIds: string[];
  demontEnabled: boolean;
};
type ServiceProduct = { id: string; options: { id: string; code: string; category: string | null }[] };

export function whiteGoodsOrderIncludesService(cards: ServiceCard[], products: ServiceProduct[]): boolean {
  return cards.some((card) => {
    if (card.demontEnabled) return true;
    const options = products.find((product) => product.id === card.productId)?.options ?? [];
    const selected = (id: string) => options.find((o) => o.id === id);
    if (card.selectedInstallOptionIds.some((id) => selected(id))) return true;
    return card.selectedExtraOptionIds.some((id) => {
      const opt = selected(id);
      return !!opt && (opt.category === "install" || SERVICE_EXTRA_CODES.has(opt.code));
    });
  });
}

// Every service a move can add (packing, move-out cleaning) is a service.
export function movingOrderIncludesService(serviceCodes: string[]): boolean {
  return serviceCodes.length > 0;
}

// Businesses have no right of withdrawal; an unknown type is treated as a
// private customer.
export function needsWithdrawalConsent(input: { customerType: BookingCustomerType | null | undefined; includesService: boolean }): boolean {
  return input.includesService && input.customerType !== "business";
}
