import { describe, expect, it } from "vitest";
import { orderRules } from "./orderRules";

const cutoff = "14. oktober 2026 kl. 10:00";
const CALL_TO_CANCEL = "Vil du avbestille, ring oss på +47 402 84 977.";

describe("orderRules", () => {
  it("before the cutoff: everything can be changed until then, then only add-ons; cancelling is by phone", () => {
    const rules = orderRules({ open: true, beforeCutoff: true, canEditItems: true, cutoffText: cutoff }, "no");

    expect(rules).toEqual([
      `Du kan endre dato, adresser og varer frem til ${cutoff}.`,
      "Etter det kan du fortsatt legge til tjenester som utpakking og endre kontaktinformasjonen din.",
      CALL_TO_CANCEL,
    ]);
  });

  it("after the cutoff: only add-ons and contact details; cancelling is by phone", () => {
    const rules = orderRules({ open: true, beforeCutoff: false, canEditItems: true, cutoffText: cutoff }, "no");

    expect(rules).toEqual([
      `Fristen for å endre dato, adresser og varer var ${cutoff}.`,
      "Du kan fortsatt legge til tjenester som utpakking og endre kontaktinformasjonen din.",
      CALL_TO_CANCEL,
    ]);
  });

  it("an order without products to change (moving, quotes): date and contact details only", () => {
    const rules = orderRules({ open: true, beforeCutoff: true, canEditItems: false, cutoffText: cutoff }, "no");

    expect(rules[0]).toBe(`Du kan endre dato og tidspunkt frem til ${cutoff}.`);
    expect(rules.join(" ")).not.toContain("utpakking");
  });

  it("a service request: everything until the cutoff, then nothing can be changed", () => {
    const before = orderRules({ open: true, beforeCutoff: true, canEditItems: true, cutoffText: cutoff, kind: "service" }, "no");
    expect(before).toEqual([
      `Du kan endre bestillingen frem til ${cutoff}.`,
      "Etter det kan bestillingen ikke endres.",
      CALL_TO_CANCEL,
    ]);

    const after = orderRules({ open: true, beforeCutoff: false, canEditItems: true, cutoffText: cutoff, kind: "service" }, "no");
    expect(after).toEqual([`Fristen for å endre bestillingen var ${cutoff}, så den kan ikke endres lenger.`, CALL_TO_CANCEL]);
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
    const rules = orderRules({ open: true, beforeCutoff: true, canEditItems: true, cutoffText: "14 October 2026 at 10:00" }, "en");
    expect(rules[0]).toBe("You can change the date, addresses and products until 14 October 2026 at 10:00.");
    expect(rules).toContain("To cancel, call us on +47 402 84 977.");
  });
});
