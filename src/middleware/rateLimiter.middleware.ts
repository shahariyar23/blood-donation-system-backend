import rateLimit from "express-rate-limit";

// ══════════════════════════════════════════════════════
//  globalLimiter
//  Applied to ALL routes in app.ts
//  100 requests per 15 minutes per IP
// ══════════════════════════════════════════════════════
export const globalLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              100,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success:    false,
    statusCode: 429,
    message:    "Too many requests. Please try again after 15 minutes.",
  },
});

// ══════════════════════════════════════════════════════
//  authLimiter
//  Applied to login + register routes only
//  10 attempts per 15 minutes per IP
// ══════════════════════════════════════════════════════
export const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success:    false,
    statusCode: 429,
    message:    "Too many login attempts. Please try again after 15 minutes.",
  },
});

// ══════════════════════════════════════════════════════
//  forgotPasswordLimiter
//  Applied to forgot-password route only
//  5 attempts per hour per IP
// ══════════════════════════════════════════════════════
export const forgotPasswordLimiter = rateLimit({
  windowMs:         60 * 60 * 1000, // 1 hour
  max:              5,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success:    false,
    statusCode: 429,
    message:    "Too many password reset requests. Please try again after 1 hour.",
  },
});

// ══════════════════════════════════════════════════════
//  otpSendLimiter
//  Applied to send-otp route
//  5 requests per 15 minutes per email (fallback to IP)
// ══════════════════════════════════════════════════════
export const otpSendLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => {
    const email = (req.body?.email || "").toString().toLowerCase().trim();
    return email || req.ip;
  },
  message: {
    success:    false,
    statusCode: 429,
    message:    "Too many OTP requests. Please try again after 15 minutes.",
  },
});

// ══════════════════════════════════════════════════════
//  otpVerifyLimiter
//  Applied to verify-otp route
//  10 attempts per 15 minutes per email (fallback to IP)
// ══════════════════════════════════════════════════════
export const otpVerifyLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => {
    const email = (req.body?.email || "").toString().toLowerCase().trim();
    return email || req.ip;
  },
  message: {
    success:    false,
    statusCode: 429,
    message:    "Too many OTP attempts. Please try again after 15 minutes.",
  },
});