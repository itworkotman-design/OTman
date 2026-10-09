// "Godt å vite" on the order page: what the customer may still change or
// cancel, and until when — the rules of lib/orders/customerOrderEditPolicy.ts
// and the cancel route, in words.

type Permissions = {
  open: boolean;
  beforeCutoff: boolean;
  // Homepage catalog orders (products, stops); moving / quote orders only
  // have a date and contact details to change.
  canEditItems: boolean;
  // The cutoff, already formatted; null = the order has no date yet.
  cutoffText: string | null;
};

export function orderRules(permissions: Permissions, locale: "no" | "en"): string[] {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const until = permissions.cutoffText ?? t("24 hours before the delivery", "24 timer før leveringen");

  if (!permissions.open) {
    return [
      t("The order can no longer be changed.", "Bestillingen kan ikke endres lenger."),
      t("Questions about the order? Contact us.", "Har du spørsmål om bestillingen, ta kontakt med oss."),
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
      t(`You can cancel the order yourself until ${until}.`, `Du kan avbestille bestillingen selv frem til ${until}.`),
      t(`After that you can still ${addOns}.`, `Etter det kan du fortsatt ${addOns}.`),
      t(
        "To cancel after the deadline, send us a request and we will contact you.",
        "Vil du avbestille etter fristen, sender du oss en forespørsel, så tar vi kontakt.",
      ),
    ];
  }

  return [
    t(`The deadline for changing ${whatChanges} was ${until}.`, `Fristen for å endre ${whatChanges} var ${until}.`),
    t(`You can still ${addOns}.`, `Du kan fortsatt ${addOns}.`),
    t("To cancel, send us a request and we will contact you.", "Vil du avbestille, sender du oss en forespørsel, så tar vi kontakt."),
  ];
}
