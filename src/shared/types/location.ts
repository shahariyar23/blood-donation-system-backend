/**
 * Transforms Nominatim API response to login location format
 */
export interface NominatimResponse {
  place_id?: number;
  licence?: string;
  osm_type?: string;
  osm_id?: number;
  lat: string | number;
  lon: string | number;
  class?: string;
  type?: string;
  place_rank?: number;
  importance?: number;
  addresstype?: string;
  name?: string;
  display_name: string;
  address?: {
    road?: string;
    quarter?: string;
    suburb?: string;
    city?: string;
    county?: string;
    state_district?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
    [key: string]: string | undefined;
  };
  boundingbox?: string[];
}

export interface LoginLocationFormat {
  displayName: string;
  road?: string;
  quarter?: string;
  suburb?: string;
  city?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export type LocationInput = NominatimResponse | LoginLocationFormat;

export const isNominatimResponse = (value: any): value is NominatimResponse => {
  return (
    value != null &&
    typeof value === "object" &&
    typeof value.display_name === "string" &&
    (typeof value.lat === "string" || typeof value.lat === "number") &&
    (typeof value.lon === "string" || typeof value.lon === "number")
  );
};

export const isLoginLocationFormat = (value: any): value is LoginLocationFormat => {
  return (
    value != null &&
    typeof value === "object" &&
    typeof value.displayName === "string" &&
    value.coordinates != null &&
    typeof value.coordinates === "object" &&
    typeof value.coordinates.lat === "number" &&
    typeof value.coordinates.lng === "number"
  );
};

export const transformLocationToLoginFormat = (
  nominatimData: NominatimResponse,
  latitude?: number | null,
  longitude?: number | null
): LoginLocationFormat => {
  const address = nominatimData.address || {};
  const lat = latitude ?? parseFloat(nominatimData.lat as string);
  const lng = longitude ?? parseFloat(nominatimData.lon as string);

  return {
    displayName: nominatimData.display_name || "",
    road: address.road || "",
    quarter: address.quarter || "",
    suburb: address.suburb || "",
    city: address.city || address.town || address.village || "",
    county: address.county || "",
    state_district: address.state_district || "",
    state: address.state || "",
    postcode: address.postcode || "",
    country: address.country || "",
    country_code: (address.country_code || "").toUpperCase(),
    coordinates: {
      lat: isNaN(lat) ? 0 : lat,
      lng: isNaN(lng) ? 0 : lng,
    },
  };
};

export const normalizeLocationToLoginFormat = (
  location: LocationInput,
  latitude?: number | null,
  longitude?: number | null,
): LoginLocationFormat => {
  if (isLoginLocationFormat(location)) {
    return {
      displayName: location.displayName || "",
      road: location.road || "",
      quarter: location.quarter || "",
      suburb: location.suburb || "",
      city: location.city || "",
      county: location.county || "",
      state_district: location.state_district || "",
      state: location.state || "",
      postcode: location.postcode || "",
      country: location.country || "",
      country_code: (location.country_code || "").toUpperCase(),
      coordinates: {
        lat: location.coordinates.lat ?? 0,
        lng: location.coordinates.lng ?? 0,
      },
    };
  }

  return transformLocationToLoginFormat(location, latitude, longitude);
};
