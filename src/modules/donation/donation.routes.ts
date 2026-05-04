import { Router, Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { protect, protectHospital } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import { ApiError } from "../../shared/utils";
import {
	approveDonation,
	createDonation,
	createDonationRequest,
	listHospitalDonations,
	listMyDonationRequests,
	rejectDonation,
	searchDonationSuggestions,
	searchDonationRequestForHospital,
} from "./donation.controller";
import {
	createDonationSchema,
	createDonationRequestSchema,
	listDonationQuerySchema,
	listMyDonationRequestQuerySchema,
	rejectDonationSchema,
	searchDonationSuggestionsQuerySchema,
	searchDonationRequestSchema,
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

// POST /api/hospital/donations
router.post(
	"/",
	protectHospital,
	requireRole("hospital"),
	validate(createDonationSchema),
	createDonation,
);

// PATCH /api/hospital/donations/:id/approve
router.patch("/:id/approve", protectHospital, requireRole("hospital"), approveDonation);

// PATCH /api/hospital/donations/:id/reject
router.patch(
	"/:id/reject",
	protectHospital,
	requireRole("hospital"),
	validate(rejectDonationSchema),
	rejectDonation,
);

// GET /api/hospital/donations
router.get(
	"/",
	protectHospital,
	requireRole("hospital"),
	validateQuery(listDonationQuerySchema),
	listHospitalDonations,
);

// POST /api/donations/request
router.post(
	"/request",
	protect,
	requireRole("user","donor","admin"),
	validate(createDonationRequestSchema),
	createDonationRequest,
);

// GET /api/donations/my-requests
router.get(
	"/my-requests",
	protect,
	requireRole("user"),
	validateQuery(listMyDonationRequestQuerySchema),
	listMyDonationRequests,
);

// POST /api/hospital/donations/search-request
router.post(
	"/search-request",
	protectHospital,
	requireRole("hospital"),
	validate(searchDonationRequestSchema),
	searchDonationRequestForHospital,
);

// GET /api/hospital/donations/search-suggestions
router.get(
	"/search-suggestions",
	protectHospital,
	requireRole("hospital"),
	validateQuery(searchDonationSuggestionsQuerySchema),
	searchDonationSuggestions,
);

export default router;
