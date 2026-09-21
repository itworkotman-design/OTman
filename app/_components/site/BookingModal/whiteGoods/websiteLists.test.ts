import { describe, expect, it } from "vitest";
import { filterUnusedLists, type WebsiteListInfo } from "./websiteLists";

const wg: WebsiteListInfo = { code: "WEBSITE_WHITE_GOODS", labelEn: "White goods", labelNo: "Hvitevarer" };
const fn: WebsiteListInfo = { code: "WEBSITE_FURNITURE", labelEn: "Furniture", labelNo: "Møbler" };

describe("filterUnusedLists", () => {
  it("offers every available list except the ones already used, in order", () => {
    expect(filterUnusedLists([wg, fn], ["WEBSITE_WHITE_GOODS"])).toEqual([fn]);
    expect(filterUnusedLists([wg, fn], [])).toEqual([wg, fn]);
  });

  it("offers nothing once every list has been used", () => {
    expect(filterUnusedLists([wg, fn], ["WEBSITE_WHITE_GOODS", "WEBSITE_FURNITURE"])).toEqual([]);
  });

  it("ignores used codes that aren't available (e.g. a list that isn't seeded)", () => {
    expect(filterUnusedLists([wg], ["SOMETHING_ELSE"])).toEqual([wg]);
  });
});
