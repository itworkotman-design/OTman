type RouteDistanceInput = {
  pickupAddress?: string | null;
  extraPickupAddresses?: string[] | null;
  deliveryAddress?: string | null;
  returnAddress?: string | null;
};

type Coordinate = [number, number];

type MapboxGeocodingFeature = {
  geometry?: {
    coordinates?: unknown;
  };
  routable_points?: Array<{
    coordinates?: unknown;
  }>;
};

type MapboxGeocodingResponse = {
  features?: MapboxGeocodingFeature[];
};

type MapboxDirectionsRoute = {
  distance?: number;
};

type MapboxDirectionsResponse = {
  code?: string;
  routes?: MapboxDirectionsRoute[];
};

type RouteDistanceResult = {
  distanceKm: string;
  stopAddresses: string[];
};

const NO_PICKUP_ADDRESS = "no shop pickup address";

function normalizeRouteAddress(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return "";
  }

  return normalized.toLocaleLowerCase() === NO_PICKUP_ADDRESS ? "" : normalized;
}

function parseCoordinatePair(value: unknown): Coordinate | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const longitude = value[0];
  const latitude = value[1];

  return typeof longitude === "number" && typeof latitude === "number"
    ? [longitude, latitude]
    : null;
}

export function buildOrderedRouteAddresses(input: RouteDistanceInput) {
  return [
    normalizeRouteAddress(input.pickupAddress),
    ...(input.extraPickupAddresses ?? []).map((address) =>
      normalizeRouteAddress(address),
    ),
    normalizeRouteAddress(input.deliveryAddress),
    normalizeRouteAddress(input.returnAddress),
  ].filter((address) => address.length > 0);
}

async function geocodeAddress(
  address: string,
  token: string,
  signal?: AbortSignal,
): Promise<Coordinate> {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", address);
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "NO");
  url.searchParams.set("language", "no");
  url.searchParams.set("limit", "1");
  url.searchParams.set("autocomplete", "false");
  url.searchParams.set("types", "address,street,place,locality");

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    signal,
  });

  const data = (await response.json().catch(() => null)) as
    | MapboxGeocodingResponse
    | null;

  if (!response.ok || !data) {
    throw new Error("MAPBOX_GEOCODING_FAILED");
  }

  const feature = Array.isArray(data.features) ? data.features[0] : null;
  const routableCoordinate = parseCoordinatePair(
    feature?.routable_points?.[0]?.coordinates,
  );
  const geometryCoordinate = parseCoordinatePair(feature?.geometry?.coordinates);
  const coordinate = routableCoordinate ?? geometryCoordinate;

  if (!coordinate) {
    throw new Error("MAPBOX_GEOCODING_NO_MATCH");
  }

  return coordinate;
}

async function getDirectionsDistanceMeters(
  coordinates: Coordinate[],
  token: string,
  signal?: AbortSignal,
) {
  const coordinatePath = coordinates.map((point) => point.join(",")).join(";");
  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatePath}`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("overview", "false");
  url.searchParams.set("alternatives", "false");

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    signal,
  });

  const data = (await response.json().catch(() => null)) as
    | MapboxDirectionsResponse
    | null;

  if (!response.ok || !data || data.code !== "Ok") {
    throw new Error("MAPBOX_DIRECTIONS_FAILED");
  }

  const distanceMeters = data.routes?.[0]?.distance;

  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters)) {
    throw new Error("MAPBOX_DIRECTIONS_NO_ROUTE");
  }

  return distanceMeters;
}

export async function getRouteDistance(
  input: RouteDistanceInput,
  signal?: AbortSignal,
): Promise<RouteDistanceResult | null> {
  const stopAddresses = buildOrderedRouteAddresses(input);

  if (stopAddresses.length < 2) {
    return null;
  }

  const token = process.env.MAPBOX_ACCESS_TOKEN;

  if (!token) {
    throw new Error("MAPBOX_ACCESS_TOKEN_MISSING");
  }

  const coordinates = await Promise.all(
    stopAddresses.map((address) => geocodeAddress(address, token, signal)),
  );
  const distanceMeters = await getDirectionsDistanceMeters(
    coordinates,
    token,
    signal,
  );

  return {
    distanceKm: (distanceMeters / 1000).toFixed(2),
    stopAddresses,
  };
}
