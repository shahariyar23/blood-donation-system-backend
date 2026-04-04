import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ApiError } from "../shared/utils";

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
    console.log("body:", req.headers["content-type"], req.body , "validation middleware")
    try {
      const body = req.body;
      if (body.location) {
      const raw = body.location;

      body.location = {
        displayName: raw.displayName || "",

        road: raw.details?.road || "",
        quarter: raw.details?.quarter || "",
        suburb: raw.details?.suburb || "",

        city: raw.details?.city || raw.details?.county || "",
        county: raw.details?.county || "",

        state_district: raw.details?.state_district || "",
        state: raw.details?.state || "",

        postcode: raw.details?.postcode || "",

        country: raw.details?.country || "",
        country_code: raw.details?.country_code || "",

        coordinates: {
          lat: raw.latitude ?? null,
          lng: raw.longitude ?? null,
        },
      };
    }
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map(
          (e) => `${e.path.join(".")}: ${e.message}`,
        );
        // log validation details for debugging
        console.error("Validation failed:", errors);
        throw new ApiError(400, "Validation failed", errors);
      }
      next(err);
    }
  };
};
