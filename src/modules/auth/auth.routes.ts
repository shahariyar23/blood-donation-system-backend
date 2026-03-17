import { Router } from "express";
import {
  register,
  login,
  logout,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  getAuthUser,
} from "./auth.controller";
import { protect }                                        from "../../middleware/auth.middleware";
import { authLimiter, forgotPasswordLimiter }             from "../../middleware/rateLimiter.middleware";
import { validate }                                       from "../../middleware/validation.middleware";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validation";

const router = Router();

// ══════════════════════════════════════════════════════
//  PUBLIC ROUTES
// ══════════════════════════════════════════════════════

// POST /api/auth/register
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  register
);

// POST /api/auth/login
router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  login
);

// POST /api/auth/refresh-token  (uses cookie — no body needed)
router.post("/refresh-token", refreshAccessToken);

// POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);

// POST /api/auth/reset-password
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  resetPassword
);

// ══════════════════════════════════════════════════════
//  PROTECTED ROUTES  (require valid JWT)
// ══════════════════════════════════════════════════════

// GET  /api/auth/me
router.get("/me", protect, getAuthUser);

// POST /api/auth/logout
router.post("/logout", protect, logout);

export default router;