import { describe, expect, it } from "vitest";
import {
  hasExtrasStepContent,
  hasInstallStepContent,
} from "./cardSectionVisibility";

describe("hasInstallStepContent", () => {
  it("is false when the product has no assembly groups, type options or pending note (pakke/pall)", () => {
    expect(
      hasInstallStepContent({
        assemblyGroupCount: 0,
        typeOptionCount: 0,
        hasNeedsImplementationNote: false,
      }),
    ).toBe(false);
  });

  it("is true when there are type options (e.g. white goods install types)", () => {
    expect(
      hasInstallStepContent({
        assemblyGroupCount: 0,
        typeOptionCount: 2,
        hasNeedsImplementationNote: false,
      }),
    ).toBe(true);
  });

  it("is true when there are furniture assembly groups", () => {
    expect(
      hasInstallStepContent({
        assemblyGroupCount: 1,
        typeOptionCount: 0,
        hasNeedsImplementationNote: false,
      }),
    ).toBe(true);
  });

  it("is true when only a pending-implementation note applies", () => {
    expect(
      hasInstallStepContent({
        assemblyGroupCount: 0,
        typeOptionCount: 0,
        hasNeedsImplementationNote: true,
      }),
    ).toBe(true);
  });
});

describe("hasExtrasStepContent", () => {
  const base = {
    showExtras: false,
    showReturn: false,
    furnitureAddonsVisible: false,
    isFurniture: false,
    installSelected: false,
    hasUnpackingOption: false,
    hasDemontOption: false,
    dismantlingGroupCount: 0,
    hasAnchoringOption: false,
    hasReturnOption: false,
  };

  it("is false for a product with a delivery type picked but no extras/return options at all (pakke/pall)", () => {
    expect(hasExtrasStepContent({ ...base, showExtras: true })).toBe(false);
  });

  it("is true when unpacking is offered and extras are shown", () => {
    expect(
      hasExtrasStepContent({
        ...base,
        showExtras: true,
        hasUnpackingOption: true,
      }),
    ).toBe(true);
  });

  it("is true when dismantling is offered for furniture", () => {
    expect(
      hasExtrasStepContent({
        ...base,
        furnitureAddonsVisible: true,
        dismantlingGroupCount: 1,
      }),
    ).toBe(true);
  });

  it("is true when a return option is offered and shown", () => {
    expect(
      hasExtrasStepContent({
        ...base,
        showReturn: true,
        hasReturnOption: true,
      }),
    ).toBe(true);
  });

  it("is true for furniture unpacking included in assembly even when showExtras is false", () => {
    expect(
      hasExtrasStepContent({
        ...base,
        isFurniture: true,
        installSelected: true,
        hasUnpackingOption: true,
      }),
    ).toBe(true);
  });
});
