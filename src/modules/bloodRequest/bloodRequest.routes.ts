import { Router } from "express";
import { ZodError, ZodSchema } from "zod";
import { protect, optionalProtect } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import { ApiError } from "../../shared/utils";
import {
	cancelBloodRequest,
	createBloodRequest,
	fulfillBloodRequest,
	getLatestBloodRequests,
	getUserBloodRequests,
    respondDonor,
	getAllBloodRequests,
} from "./bloodRequest.controller";
import {
	cancelBloodRequestParamsSchema,
	createBloodRequestSchema,
	fulfillBloodRequestParamsSchema,
	getUserBloodRequestsQuerySchema,
	getAllBloodRequestsQuerySchema,
} from "./bloodRequest.validation";

import { respondBloodRequestParamsSchema } from "./bloodRequest.validation";

const router = Router();

const validateQuery = (schema: ZodSchema) => {
	return (req: any, _res: any, next: any): void => {
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

				const errors = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
				throw new ApiError(400, userFriendlyMessage, errors);
			}

			next(err);
		}
	};
};

const validateParams = (schema: ZodSchema) => {
	return (req: any, _res: any, next: any): void => {
		try {
			req.params = schema.parse(req.params) as any;
			next();
		} catch (err) {
			if (err instanceof ZodError) {
				const firstError = err.errors[0];
				const fieldName = firstError.path.join(".");
				const userFriendlyMessage = firstError.message === "Required"
					? `${fieldName} is required`
					: firstError.message;

				const errors = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
				throw new ApiError(400, userFriendlyMessage, errors);
			}

			next(err);
		}
	};
};

router.post("/", protect, validate(createBloodRequestSchema), createBloodRequest);
router.get("/latest", getLatestBloodRequests);
router.get("/all", optionalProtect, validateQuery(getAllBloodRequestsQuerySchema), getAllBloodRequests);
router.post("/:id/respond", protect, validateParams(respondBloodRequestParamsSchema), respondDonor);
router.get("/", protect, validateQuery(getUserBloodRequestsQuerySchema), getUserBloodRequests);
router.patch("/:id/fulfilled", protect, validateParams(fulfillBloodRequestParamsSchema), fulfillBloodRequest);
router.patch("/:id/cancel", protect, validateParams(cancelBloodRequestParamsSchema), cancelBloodRequest);

export default router;
