import { Router, Request, Response, NextFunction } from "express";
import { ZodError, ZodSchema } from "zod";
import { protect, protectHospital } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { ApiError } from "../../shared/utils";
import {
  registerHospital,
  hospitalLogin,
  refreshHospitalAccessToken,
  hospitalLogout,
  forgotPassword,
  resetPassword,
  changePassword,
} from "./hospital.controller";
import {
  registerHospitalSchema,
  hospitalLoginSchema,
  hospitalForgotPasswordSchema,
  hospitalResetPasswordSchema,
  changePasswordSchema,
} from "./hospital.validation";

const router = Router();

// ── Validation middleware ──────────────────────────────
const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body) as any;
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

// ══════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════

// POST /api/v1/hospital/auth/login
router.post("/auth/login", validate(hospitalLoginSchema), hospitalLogin);

// POST /api/v1/hospital/auth/refresh-token
router.post("/auth/refresh-token", refreshHospitalAccessToken);

// POST /api/v1/hospital/auth/forgot-password
router.post("/auth/forgot-password", validate(hospitalForgotPasswordSchema), forgotPassword);

// POST /api/v1/hospital/auth/reset-password
router.post("/auth/reset-password", validate(hospitalResetPasswordSchema), resetPassword);

// POST /api/v1/hospital/auth/register
router.post(
  "/auth/register",
  protect,
  requireRole("admin"),
  validate(registerHospitalSchema),
  registerHospital,
);

// POST /api/v1/hospital/auth/change-password
router.post(
  "/auth/change-password",
  protectHospital,
  requireRole("hospital"),
  validate(changePasswordSchema),
  changePassword,
);

// POST /api/v1/hospital/auth/logout
router.post("/auth/logout", protectHospital, requireRole("hospital"), hospitalLogout);

export default router;
