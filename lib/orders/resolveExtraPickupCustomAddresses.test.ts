import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getVisibleCustomPickupAddressMock: vi.fn(),
}));

vi.mock("@/lib/pickupAddresses/visibility", () => ({
  getVisibleCustomPickupAddress: mocks.getVisibleCustomPickupAddressMock,
}));

import { resolveExtraPickupCustomAddresses } from "./resolveExtraPickupCustomAddresses";

describe("resolveExtraPickupCustomAddresses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaves a plain (non-saved) pickup untouched", async () => {
    const pickup = {
      address: "Typed address",
      phone: "",
      email: "",
      sendEmail: true,
      customPickupAddressId: null,
      customPickupAddressName: null,
      customPickupAddressPhone: null,
      latitude: null,
      longitude: null,
    };

    const result = await resolveExtraPickupCustomAddresses([pickup], "user-1", "company-1");

    expect(result).toEqual({ extraPickups: [pickup], invalidPickupIndex: null });
    expect(mocks.getVisibleCustomPickupAddressMock).not.toHaveBeenCalled();
  });

  it("keeps a manually-found pickup's own coordinates instead of nulling them out", async () => {
    const pickup = {
      address: "Typed address",
      phone: "",
      email: "",
      sendEmail: true,
      customPickupAddressId: null,
      customPickupAddressName: null,
      customPickupAddressPhone: null,
      latitude: 59.9,
      longitude: 10.7,
    };

    const result = await resolveExtraPickupCustomAddresses([pickup], "user-1", "company-1");

    expect(result).toEqual({ extraPickups: [pickup], invalidPickupIndex: null });
    expect(mocks.getVisibleCustomPickupAddressMock).not.toHaveBeenCalled();
  });

  it("re-derives address/name/phone/coordinates from the authoritative saved-address record", async () => {
    mocks.getVisibleCustomPickupAddressMock.mockResolvedValue({
      id: "cpa-1",
      name: "Power Storo",
      address: "Storo Storsenter 1, 0587 Oslo",
      phone: "22334455",
      latitude: 59.945,
      longitude: 10.7669,
    });

    const result = await resolveExtraPickupCustomAddresses(
      [
        {
          address: "Address the client tried to submit directly",
          phone: "",
          email: "",
          sendEmail: true,
          customPickupAddressId: "cpa-1",
          customPickupAddressName: "Spoofed name",
          customPickupAddressPhone: "Spoofed phone",
          latitude: 1,
          longitude: 1,
        },
      ],
      "user-1",
      "company-1",
    );

    expect(mocks.getVisibleCustomPickupAddressMock).toHaveBeenCalledWith("cpa-1", "user-1", "company-1");
    expect(result).toEqual({
      extraPickups: [
        {
          address: "Storo Storsenter 1, 0587 Oslo",
          phone: "",
          email: "",
          sendEmail: true,
          customPickupAddressId: "cpa-1",
          customPickupAddressName: "Power Storo",
          customPickupAddressPhone: "22334455",
          latitude: 59.945,
          longitude: 10.7669,
        },
      ],
      invalidPickupIndex: null,
    });
  });

  it("reports the index of a pickup whose saved address isn't visible to this user", async () => {
    mocks.getVisibleCustomPickupAddressMock.mockResolvedValueOnce(null);

    const result = await resolveExtraPickupCustomAddresses(
      [
        {
          address: "Store 1",
          phone: "",
          email: "",
          sendEmail: true,
          customPickupAddressId: "cpa-missing",
          customPickupAddressName: null,
          customPickupAddressPhone: null,
          latitude: null,
          longitude: null,
        },
      ],
      "user-1",
      "company-1",
    );

    expect(result.invalidPickupIndex).toBe(0);
  });
});
