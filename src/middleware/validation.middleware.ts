import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ApiError } from "../shared/utils";

const normalizeLocation = (location: any) => {
  if (!location || typeof location !== "object") {
    return location;
  }

  const details =
    location.details && typeof location.details === "object"
      ? location.details
      : location;

  const latitude =
    typeof location.latitude === "number"
      ? location.latitude
      : typeof location.coordinates?.lat === "number"
        ? location.coordinates.lat
        : null;

  const longitude =
    typeof location.longitude === "number"
      ? location.longitude
      : typeof location.coordinates?.lng === "number"
        ? location.coordinates.lng
        : null;

  return {
    displayName: location.displayName || details.displayName || "",
    road: details.road || "",
    quarter: details.quarter || "",
    suburb: details.suburb || "",
    city: details.city || details.county || "",
    county: details.county || "",
    state_district: details.state_district || "",
    state: details.state || "",
    postcode: details.postcode || "",
    country: details.country || "",
    country_code: details.country_code || "",
    coordinates: {
      lat: latitude,
      lng: longitude,
    },
  };
};

// ══════════════════════════════════════════════════════
//  validate(schema)
//  Validates req.body against a Zod schema
//  Throws 400 with field-level error messages if invalid
//
//  Usage:
//    import { registerSchema } from "../modules/auth/auth.validation"
//    router.post("/register", validate(registerSchema), register)
// ══════════════════════════════════════════════════════
export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const body = req.body;
// console.log(body)
      if (body.location) {
        body.location = normalizeLocation(body.location);
      }

      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        // Extract the first, most specific error message to show to the user
        const firstError = err.errors[0];
        const fieldName = firstError.path.join(".");
        
        // Create a more user-friendly message
        const userFriendlyMessage = firstError.message === "Required" 
          ? `${fieldName} is required` 
          : firstError.message;

        const errors = err.errors.map(
          (e) => `${e.path.join(".")}: ${e.message}`,
        );
        
        console.error("Validation failed:", errors);
        
        // Pass the single user-friendly message as the main message, and the full array as details
        throw new ApiError(400, userFriendlyMessage, errors);
      }
      next(err);
    }
  };
};
