import { describe, expect, it } from "vitest";
import {
  WITHDRAWAL_CONSENT_TEXT,
  movingOrderIncludesService,
  needsWithdrawalConsent,
  whiteGoodsOrderIncludesService,
} from "./withdrawalConsent";

const option = (id: string, code: string, category: string) => ({ id, code, category });
const products = [
  {
    id: "tv",
    options: [option("tv-mount", "TV_WALL_MOUNT", "install"), option("unpack", "UNPACKING", "extra"), option("pallet", "PALLET_PICKUP", "extra")],
  },
  {
    id: "bed",
    options: [
      option("anchor", "WALL_ANCHORING", "extra"),
      option("dis-disp", "DISMANTLE_DISP_STD", "extra"),
      option("dis-car", "DISMANTLE_CAR_STD", "extra"),
      option("ret", "RETURN_OLD", "return"),
    ],
  },
];
const card = (over: Record<string, unknown> = {}) => ({
  productId: "tv",
  selectedInstallOptionIds: [] as string[],
  selectedExtraOptionIds: [] as string[],
  selectedReturnOptionId: null as string | null,
  demontEnabled: false,
  ...over,
});

describe("whiteGoodsOrderIncludesService — work beyond transporting goods (has a right of withdrawal)", () => {
  it("is false for plain delivery, unpacking, taking the pallet or the old appliance away", () => {
    expect(whiteGoodsOrderIncludesService([card()], products)).toBe(false);
    expect(whiteGoodsOrderIncludesService([card({ selectedExtraOptionIds: ["unpack", "pallet"] })], products)).toBe(false);
    expect(whiteGoodsOrderIncludesService([card({ productId: "bed", selectedReturnOptionId: "ret" })], products)).toBe(false);
  });

  it("is true for any installation", () => {
    expect(whiteGoodsOrderIncludesService([card(), card({ selectedInstallOptionIds: ["tv-mount"] })], products)).toBe(true);
  });

  it("is true for disconnecting the old appliance, dismantling furniture or anchoring it to the wall", () => {
    expect(whiteGoodsOrderIncludesService([card({ demontEnabled: true })], products)).toBe(true);
    for (const id of ["anchor", "dis-disp", "dis-car"]) {
      expect(whiteGoodsOrderIncludesService([card({ productId: "bed", selectedExtraOptionIds: [id] })], products), id).toBe(true);
    }
  });
});

describe("movingOrderIncludesService", () => {
  it("is true once packing, cleaning or any other service is added to the move", () => {
    expect(movingOrderIncludesService([])).toBe(false);
    expect(movingOrderIncludesService(["SERVICE_NEDPAKKING"])).toBe(true);
  });
});

describe("needsWithdrawalConsent", () => {
  it("only asks private customers (businesses have no right of withdrawal)", () => {
    expect(needsWithdrawalConsent({ customerType: "private", includesService: true })).toBe(true);
    expect(needsWithdrawalConsent({ customerType: null, includesService: true })).toBe(true);
    expect(needsWithdrawalConsent({ customerType: "business", includesService: true })).toBe(false);
    expect(needsWithdrawalConsent({ customerType: "private", includesService: false })).toBe(false);
  });

  it("has the wording the customer ticks, in both languages", () => {
    expect(WITHDRAWAL_CONSENT_TEXT.no).toMatch(/angrefristen/);
    expect(WITHDRAWAL_CONSENT_TEXT.no).toMatch(/fullført/);
    expect(WITHDRAWAL_CONSENT_TEXT.en).toMatch(/withdrawal/);
  });
});
