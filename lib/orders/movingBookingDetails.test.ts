import { describe, expect, it } from "vitest";
import { parseMovingProperty, type MovingProperty } from "./movingProperty";
import { MOVING_ORDER_KIND, buildMovingBookingDetails, parseMovingBookingDetails } from "./movingBookingDetails";

function property(raw: Record<string, unknown>): MovingProperty {
  const parsed = parseMovingProperty(raw);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.property;
}

const origin = property({ homeType: "APARTMENT", sizeOptionCode: "SIZE_UNDER_40", floors: 1, floorNumber: 4, hasLift: false, parking: "WITHIN_50M" });
const destination = property({ homeType: "DETACHED", sizeOptionCode: "SIZE_UNDER_100", floors: 2, parking: "OUTSIDE" });

describe("moving booking details (Order.websiteBookingDetails for a MOVING order)", () => {
  it("tags moving orders with their own website order kind", () => {
    expect(MOVING_ORDER_KIND).toBe("MOVING");
  });

  it("stores both ends as the flow's draft codes, the services and the customer type", () => {
    const details = buildMovingBookingDetails({ customerType: "business", origin, destination, serviceCodes: ["SERVICE_FLYTTEVASK"] });
    expect(details).toEqual({
      version: 1,
      customerType: "business",
      origin: { homeType: "APARTMENT", sizeOptionCode: "SIZE_UNDER_40", floors: 1, floorNumber: 4, hasLift: false, parking: "WITHIN_50M" },
      destination: { homeType: "DETACHED", sizeOptionCode: "SIZE_UNDER_100", floors: 2, floorNumber: null, hasLift: null, parking: "OUTSIDE" },
      serviceCodes: ["SERVICE_FLYTTEVASK"],
    });
  });

  it("round-trips through JSON", () => {
    const details = buildMovingBookingDetails({ customerType: null, origin, destination, serviceCodes: [] });
    expect(parseMovingBookingDetails(JSON.parse(JSON.stringify(details)))).toEqual(details);
  });

  it("rejects anything that isn't a valid version-1 moving record (older orders stored none)", () => {
    expect(parseMovingBookingDetails(null)).toBeNull();
    expect(parseMovingBookingDetails({ version: 2 })).toBeNull();
    const details = buildMovingBookingDetails({ customerType: "private", origin, destination, serviceCodes: [] });
    expect(parseMovingBookingDetails({ ...details, origin: { ...details.origin, homeType: "CASTLE" } })).toBeNull();
    expect(parseMovingBookingDetails({ ...details, serviceCodes: "SERVICE_FLYTTEVASK" })).toBeNull();
  });

  it("drops an unknown customer type rather than failing the whole record", () => {
    const details = buildMovingBookingDetails({ customerType: "private", origin, destination, serviceCodes: [] });
    expect(parseMovingBookingDetails({ ...details, customerType: "alien" })?.customerType).toBeNull();
  });
});
