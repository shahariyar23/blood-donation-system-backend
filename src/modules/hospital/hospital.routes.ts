import { Router, Request, Response, NextFunction } from "express";
import { ZodError, ZodSchema } from "zod";
import { protect } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { ApiError } from "../../shared/utils";
import { searchHospitalDonor } from "./hospital.controller";
import { searchHospitalDonorSchema } from "./hospital.validation";

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

        const errors = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
        throw new ApiError(400, userFriendlyMessage, errors);
      }
      next(err);
    }
  };
};

router.use(protect, requireRole("hospital"));

// GET /api/v1/hospital/donors/search?identifier=...
router.get("/donors/search", validateQuery(searchHospitalDonorSchema), searchHospitalDonor);

export default router;
