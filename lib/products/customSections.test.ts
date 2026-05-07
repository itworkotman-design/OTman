import { describe, expect, it } from "vitest";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import {
  isCustomSectionVisibleForDeliveryType,
  normalizeProductCustomSections,
} from "@/lib/products/customSections";

describe("normalizeProductCustomSections", () => {
  it("defaults custom sections to install-only display", () => {
    const [section] = normalizeProductCustomSections([
      {
        id: "section-1",
        title: "Wall type",
        options: [],
      },
    ]);

    expect(section?.displayOnDeliveryTypes).toEqual([
      DELIVERY_TYPES.INSTALL_ONLY,
    ]);
  });

  it("keeps valid delivery type display keys", () => {
    const [section] = normalizeProductCustomSections([
      {
        id: "section-1",
        title: "Wall type",
        displayOnDeliveryTypes: [
          DELIVERY_TYPES.INDOOR,
          DELIVERY_TYPES.RETURN_ONLY,
          "invalid",
        ],
        options: [],
      },
    ]);

    expect(section?.displayOnDeliveryTypes).toEqual([
      DELIVERY_TYPES.INDOOR,
      DELIVERY_TYPES.RETURN_ONLY,
    ]);
  });
});

describe("isCustomSectionVisibleForDeliveryType", () => {
  const [section] = normalizeProductCustomSections([
    {
      id: "section-1",
      title: "Wall type",
      displayOnDeliveryTypes: [DELIVERY_TYPES.INSTALL_ONLY],
      options: [],
    },
  ]);

  it("shows sections for products without delivery type selection", () => {
    expect(
      isCustomSectionVisibleForDeliveryType({
        allowDeliveryTypes: false,
        deliveryType: "",
        section: section!,
      }),
    ).toBe(true);
  });

  it("shows sections only for configured delivery types", () => {
    expect(
      isCustomSectionVisibleForDeliveryType({
        allowDeliveryTypes: true,
        deliveryType: "",
        section: section!,
      }),
    ).toBe(false);
    expect(
      isCustomSectionVisibleForDeliveryType({
        allowDeliveryTypes: true,
        deliveryType: DELIVERY_TYPES.INSTALL_ONLY,
        section: section!,
      }),
    ).toBe(true);
    expect(
      isCustomSectionVisibleForDeliveryType({
        allowDeliveryTypes: true,
        deliveryType: DELIVERY_TYPES.INDOOR,
        section: section!,
      }),
    ).toBe(false);
  });
});
