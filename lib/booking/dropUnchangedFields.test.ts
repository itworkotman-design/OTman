import { describe, expect, it } from "vitest";
import { dropUnchangedFields } from "./dropUnchangedFields";

describe("dropUnchangedFields", () => {
  it("removes fields whose value already equals the current one", () => {
    const current = { selectedReturnOptionId: null, amount: 2, selectedExtraOptionIds: ["a"] };

    expect(
      dropUnchangedFields(current, { selectedReturnOptionId: null, amount: 1 }),
    ).toEqual({ amount: 1 });
  });

  it("compares arrays and objects by value, not identity", () => {
    const current = { ids: ["a", "b"], sections: [{ id: "s", optionIds: ["x"] }] };

    expect(
      dropUnchangedFields(current, { ids: ["a", "b"], sections: [{ id: "s", optionIds: ["x"] }] }),
    ).toEqual({});
  });

  it("keeps genuinely changed fields", () => {
    expect(dropUnchangedFields({ ids: ["a"] }, { ids: [] })).toEqual({ ids: [] });
  });
});
