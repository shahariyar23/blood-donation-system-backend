import { Router, Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { protect } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import { ApiError } from "../../shared/utils";
import {
	approveDonation,
	createDonation,
	listHospitalDonations,
	rejectDonation,
} from "./donation.controller";
import {
	createDonationSchema,
	listDonationQuerySchema,
	rejectDonationSchema,
} from "./donation.validation";

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
//  HOSPITAL ROUTES
// ══════════════════════════════════════════════════════

router.use(protect, requireRole("hospital"));

// POST /api/hospital/donations
router.post("/", validate(createDonationSchema), createDonation);

// PATCH /api/hospital/donations/:id/approve
router.patch("/:id/approve", approveDonation);

// PATCH /api/hospital/donations/:id/reject
router.patch("/:id/reject", validate(rejectDonationSchema), rejectDonation);

// GET /api/hospital/donations
router.get("/", validateQuery(listDonationQuerySchema), listHospitalDonations);

export default router;
