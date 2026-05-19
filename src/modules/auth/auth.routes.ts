import { Router } from "express";
import {
  uploadAvatar,
  register,
  login,
  logout,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  sendEmailOtp,
  verifyEmailOtp,
  getAuthUser,
  updateAuthUser,
  getAuthSettings,
  updateAuthSettings,
  updateNotificationSettings,
  updatePrivacySettings,
  changePassword,
  getMySessions,
  logoutOtherSessions,
  logoutSingleSession,
  deactivateAccount,
  deleteAccount,
} from "./auth.controller";
import { protect } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";
import {
  authLimiter,
  forgotPasswordLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
} from "../../middleware/rateLimiter.middleware";
import { validate } from "../../middleware/validation.middleware";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sendOtpSchema,
  verifyOtpSchema,
  updateSettingsSchema,
  notificationsSettingsSchema,
  privacySettingsSchema,
} from "./auth.validation";

const router = Router();

// ══════════════════════════════════════════════════════
//  PUBLIC ROUTES
// ══════════════════════════════════════════════════════

// POST /api/auth/upload-avatar
router.post("/upload-avatar", authLimiter, upload.avatar, uploadAvatar);

// POST /api/auth/register
router.post("/register", authLimiter, validate(registerSchema), register);

// POST /api/auth/login
router.post("/login", authLimiter, validate(loginSchema), login);

// POST /api/auth/refresh-token  (uses cookie — no body needed)
router.post("/refresh-token", refreshAccessToken);

// POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  forgotPassword,
);

// POST /api/auth/reset-password
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

// POST /api/auth/send-otp
router.post("/send-otp", otpSendLimiter, validate(sendOtpSchema), sendEmailOtp);

// POST /api/auth/verify-otp
router.post("/verify-otp", otpVerifyLimiter, validate(verifyOtpSchema), verifyEmailOtp);

// ══════════════════════════════════════════════════════
//  PROTECTED ROUTES  (require valid JWT)
// ══════════════════════════════════════════════════════

// GET  /api/auth/me
router.get("/me", protect, getAuthUser);

// PATCH /api/auth/me
router.patch("/me", protect, updateAuthUser);

// GET /api/auth/settings
router.get("/settings", protect, getAuthSettings);

// PATCH /api/auth/settings
router.patch("/settings", protect, validate(updateSettingsSchema), updateAuthSettings);

// PATCH /api/auth/settings/notifications
router.patch(
  "/settings/notifications",
  protect,
  validate(notificationsSettingsSchema),
  updateNotificationSettings,
);

// PATCH /api/auth/settings/privacy
router.patch(
  "/settings/privacy",
  protect,
  validate(privacySettingsSchema),
  updatePrivacySettings,
);

// POST /api/auth/change-password
router.post("/change-password", protect, changePassword);

// GET /api/auth/sessions
router.get("/sessions", protect, getMySessions);

// POST /api/auth/sessions/logout-others
router.post("/sessions/logout-others", protect, logoutOtherSessions);

// DELETE /api/auth/sessions/:sessionId
router.delete("/sessions/:sessionId", protect, logoutSingleSession);

// POST /api/auth/deactivate-account
router.post("/deactivate-account", protect, deactivateAccount);

// DELETE /api/auth/delete-account
router.delete("/delete-account", protect, deleteAccount);

// POST /api/auth/logout
router.post("/logout", protect, logout);

export default router;
