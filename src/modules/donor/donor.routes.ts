import { Router, Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ApiError } from "../../shared/utils";
import { getDonors } from "./donor.controller";
import { searchDonorSchema } from "./donor.validation";

const router = Router();

const validateQuery = (schema: ZodSchema) => {
	return (req: Request, _res: Response, next: NextFunction): void => {
		try {
			req.query = schema.parse(req.query) as any;
			next();
		} catch (err) {
			if (err instanceof ZodError) {
				const firstError = err.errors[0];
				const fieldName = firstError.path.join(".");
				const userFriendlyMessage = firstError.message === "Required"
					? `${fieldName} is required`
					: firstError.message;

				const errors = err.errors.map(
					(e) => `${e.path.join(".")}: ${e.message}`,
				);

				throw new ApiError(400, userFriendlyMessage, errors);
			}
			next(err);
		}
	};
};

// ══════════════════════════════════════════════════════
//  PUBLIC ROUTES
// ══════════════════════════════════════════════════════

// GET /api/donors
router.get("/", validateQuery(searchDonorSchema), getDonors);

export default router;
