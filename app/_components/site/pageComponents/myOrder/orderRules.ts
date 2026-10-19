import { CALL_TO_CANCEL } from "@/lib/content/companyContact";

// "Godt å vite" on the order page: what the customer may still change, and
// until when — the rules of lib/orders/customerOrderEditPolicy.ts in words.
// Cancelling is by phone only.

type Permissions = {
  open: boolean;
  beforeCutoff: boolean;
  // Homepage catalog orders (products, stops); moving / quote orders only
  // have a date and contact details to change.
  canEditItems: boolean;
  // The cutoff, already formatted; null = the order has no date yet.
  cutoffText: string | null;
  // A service request: everything until the cutoff, nothing after.
  kind?: "service";
};

export function orderRules(permissions: Permissions, locale: "no" | "en"): string[] {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const until = permissions.cutoffText ?? t("24 hours before the delivery", "24 timer før leveringen");
  const callToCancel = CALL_TO_CANCEL[locale];

  if (!permissions.open) {
    return [
      t("The order can no longer be changed.", "Bestillingen kan ikke endres lenger."),
      t("Questions about the order? Contact us.", "Har du spørsmål om bestillingen, ta kontakt med oss."),
    ];
  }

  // A service request is frozen completely at the cutoff.
  if (permissions.kind === "service") {
    if (permissions.beforeCutoff) {
      return [
        t(`You can change the order until ${until}.`, `Du kan endre bestillingen frem til ${until}.`),
        t("After that the order can't be changed.", "Etter det kan bestillingen ikke endres."),
        callToCancel,
      ];
    }
    return [
      t(`The deadline for changing the order was ${until}, so it can no longer be changed.`, `Fristen for å endre bestillingen var ${until}, så den kan ikke endres lenger.`),
      callToCancel,
    ];
  }

  const whatChanges = permissions.canEditItems
    ? t("the date, addresses and products", "dato, adresser og varer")
    : t("the date and time", "dato og tidspunkt");
  const addOns = permissions.canEditItems
      ? t("add services such as unpacking and change your contact details", "legge til tjenester som utpakking og endre kontaktinformasjonen din")
      : t("change your contact details", "endre kontaktinformasjonen din");

  if (permissions.beforeCutoff) {
    return [
      t(`You can change ${whatChanges} until ${until}.`, `Du kan endre ${whatChanges} frem til ${until}.`),
      t(`After that you can still ${addOns}.`, `Etter det kan du fortsatt ${addOns}.`),
      callToCancel,
    ];
  }

  return [
    t(`The deadline for changing ${whatChanges} was ${until}.`, `Fristen for å endre ${whatChanges} var ${until}.`),
    t(`You can still ${addOns}.`, `Du kan fortsatt ${addOns}.`),
    callToCancel,
  ];
}
