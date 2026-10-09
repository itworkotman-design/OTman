import { describe, expect, it } from "vitest";
import { orderRules } from "./orderRules";

const cutoff = "14. oktober 2026 kl. 10:00";

describe("orderRules", () => {
  it("before the cutoff: everything can be changed and the order cancelled until then, then only add-ons", () => {
    const rules = orderRules({ open: true, beforeCutoff: true, canEditItems: true, cutoffText: cutoff }, "no");

    expect(rules).toEqual([
      `Du kan endre dato, adresser og varer frem til ${cutoff}.`,
      `Du kan avbestille bestillingen selv frem til ${cutoff}.`,
      "Etter det kan du fortsatt legge til tjenester som utpakking og endre kontaktinformasjonen din.",
      "Vil du avbestille etter fristen, sender du oss en forespørsel, så tar vi kontakt.",
    ]);
  });

  it("after the cutoff: only add-ons and contact details, and cancelling is a request", () => {
    const rules = orderRules({ open: true, beforeCutoff: false, canEditItems: true, cutoffText: cutoff }, "no");

    expect(rules).toEqual([
      `Fristen for å endre dato, adresser og varer var ${cutoff}.`,
      "Du kan fortsatt legge til tjenester som utpakking og endre kontaktinformasjonen din.",
      "Vil du avbestille, sender du oss en forespørsel, så tar vi kontakt.",
    ]);
  });

  it("an order without products to change (moving, quotes): date and contact details only", () => {
    const rules = orderRules({ open: true, beforeCutoff: true, canEditItems: false, cutoffText: cutoff }, "no");

    expect(rules[0]).toBe(`Du kan endre dato og tidspunkt frem til ${cutoff}.`);
    expect(rules.join(" ")).not.toContain("utpakking");
  });

  it("an order with no date yet: 24h before the delivery", () => {
    const rules = orderRules({ open: true, beforeCutoff: true, canEditItems: true, cutoffText: null }, "no");

    expect(rules[0]).toBe("Du kan endre dato, adresser og varer frem til 24 timer før leveringen.");
  });

  it("a closed order can't be changed", () => {
    expect(orderRules({ open: false, beforeCutoff: false, canEditItems: true, cutoffText: cutoff }, "no")).toEqual([
      "Bestillingen kan ikke endres lenger.",
      "Har du spørsmål om bestillingen, ta kontakt med oss.",
    ]);
  });

  it("speaks English on the English site", () => {
    expect(orderRules({ open: true, beforeCutoff: true, canEditItems: true, cutoffText: "14 October 2026 at 10:00" }, "en")[0]).toBe(
      "You can change the date, addresses and products until 14 October 2026 at 10:00.",
    );
  });
});
