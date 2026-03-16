import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import UAParser from "ua-parser-js";
import geoip from "geoip-lite";
import User from "../user/User.schema";
import Session from "./Session.schema";
import UserActivity from "../user/UserActivity.schema";
import {
  ApiResponse,
  ApiError,
  asyncHandler,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  sendEmail,
} from "../../shared/utils";

// ══════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════

const cookieOptions = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge:   7 * 24 * 60 * 60 * 1000,
};

// In-memory store for reset tokens — replace with Redis in production
const resetTokenStore = new Map<
  string,
  { userId: string; expiresAt: number }
>();

// ── Parse device + browser from user-agent ─────────────
const parseDevice = (userAgent: string) => {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  return {
    device: {
      type:      result.device.type    || "desktop",
      brand:     result.device.vendor  || "unknown",
      model:     result.device.model   || "unknown",
      os:        result.os.name        || "unknown",
      osVersion: result.os.version     || "unknown",
    },
    browser: {
      name:           result.browser.name    || "unknown",
      version:        result.browser.version || "unknown",
      engine:         result.engine.name     || "unknown",
      language:       "unknown",
      cookiesEnabled: false,
      doNotTrack:     false,
      userAgent,
    },
  };
};

// ── Get real location from IP ──────────────────────────
const getIpLocation = (ip: string) => {
  const cleanIp = ip.replace("::ffff:", "");
  const geo     = geoip.lookup(cleanIp);
  return {
    country:     geo?.country  || "",
    city:        geo?.city     || "",
    state:       geo?.region   || "",
    coordinates: {
      lat: geo?.ll?.[0] ?? null,
      lng: geo?.ll?.[1] ?? null,
    },
  };
};

// ══════════════════════════════════════════════════════
//  VPN DETECTION
//
//  Frontend sends location: { city, country, country_code,
//    county, postcode, state, state_district, coordinates }
//  Backend looks up the real location from IP via geoip-lite
//  If country OR both city+state don't match → VPN detected
// ══════════════════════════════════════════════════════
const detectVpn = (
  frontendLocation: Record<string, any>,
  ip: string
): { isVpn: boolean; reason?: string } => {

  const ipLoc = getIpLocation(ip);

  // Skip check for localhost / private IPs (dev environment)
  if (!ipLoc.country) return { isVpn: false };

  const fCountry = (frontendLocation.country_code || "").toUpperCase().trim();
  const iCountry = (ipLoc.country                 || "").toUpperCase().trim();

  const fCity    = (frontendLocation.city  || "").toLowerCase().trim();
  const fState   = (frontendLocation.state || "").toLowerCase().trim();

  const iCity    = (ipLoc.city  || "").toLowerCase().trim();
  const iState   = (ipLoc.state || "").toLowerCase().trim();

  // ── Rule 1: Country must match ─────────────────────
  if (fCountry && iCountry && fCountry !== iCountry) {
    return {
      isVpn:  true,
      reason: `Country mismatch — your device reports "${fCountry}" but your network IP is from "${iCountry}". VPN or proxy is not allowed.`,
    };
  }

  // ── Rule 2: City AND state both mismatch → VPN ─────
  const cityMatch  = fCity  && iCity  && fCity  === iCity;
  const stateMatch = fState && iState && fState === iState;

  if (fCity && fState && !cityMatch && !stateMatch) {
    return {
      isVpn:  true,
      reason: `Location mismatch — your device location (${fCity}, ${fState}) does not match your IP address location (${iCity}, ${iState}). Please disable your VPN or proxy.`,
    };
  }

  return { isVpn: false };
};

// ══════════════════════════════════════════════════════
//  POST /auth/register
//  Full donor registration with location + VPN check
// ══════════════════════════════════════════════════════
export const register = asyncHandler(async (req: Request, res: Response) => {
  const {
    // required
    name,
    email,
    phone,
    password,

    // donor info
    age,
    gender,
    bloodType,
    weight,
    dateOfBirth,

    // location from frontend (browser GPS / reverse geocode)
    location,

    // optional
    socialLinks,
  } = req.body;

  // ── Required field validation ──────────────────────
  if (!name || !email || !phone || !password) {
    throw new ApiError(400, "Name, email, phone and password are required");
  }
  if (password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }
  if (!bloodType) {
    throw new ApiError(400, "Blood type is required");
  }
  if (!location || !location.country_code) {
    throw new ApiError(400, "Location data is required — please allow location access");
  }

  // ── VPN / proxy check ──────────────────────────────
  const ip = (req.ip || "").replace("::ffff:", "");
  const { isVpn, reason } = detectVpn(location, ip);

  if (isVpn) {
    throw new ApiError(
      403,
      `Registration blocked. ${reason}`
    );
  }

  // ── Check duplicates ───────────────────────────────
  const [existingEmail, existingPhone] = await Promise.all([
    User.findOne({ email:  email.toLowerCase() }),
    User.findOne({ phone }),
  ]);

  if (existingEmail) throw new ApiError(409, "This email is already registered");
  if (existingPhone) throw new ApiError(409, "This phone number is already registered");

  // ── Hash password ──────────────────────────────────
  const passwordHash = await bcrypt.hash(password, 12);

  // ── Build location from frontend data ─────────────
  const userLocation = {
    city:           location.city           || "",
    country:        location.country        || "",
    country_code:   location.country_code   || "",
    county:         location.county         || "",
    postcode:       location.postcode       || "",
    state:          location.state          || "",
    state_district: location.state_district || "",
    coordinates: {
      lat: location.coordinates?.lat ?? null,
      lng: location.coordinates?.lng ?? null,
    },
  };

  // ── Create full donor user ─────────────────────────
  const user = await User.create({
    // basic
    name,
    email,
    phone,
    passwordHash,

    // personal
    age:         age         || null,
    gender:      gender      || null,
    bloodType,
    weight:      weight      || null,
    dateOfBirth: dateOfBirth || null,

    // all users are donors
    role:             "donor",
    isAvailable:      false,   // donor manually enables this later
    isDonorVerified:  false,   // admin verifies after review
    totalDonations:   0,
    lastDonationDate: null,

    // location
    location: userLocation,

    // social links
    socialLinks: {
      facebook:  socialLinks?.facebook  || null,
      instagram: socialLinks?.instagram || null,
      twitter:   socialLinks?.twitter   || null,
    },
  });

  // ── Log activity ───────────────────────────────────
  await UserActivity.create({
    userId:    user._id,
    event:     "register",
    meta:      {
      bloodType:  user.bloodType,
      city:       userLocation.city,
      country:    userLocation.country_code,
    },
    ip,
    userAgent: req.headers["user-agent"] || "",
    timestamp: new Date(),
  }).catch(() => {});

  res.status(201).json(
    new ApiResponse(201, "Account created successfully. Please log in.", {
      id:        user._id,
      name:      user.name,
      email:     user.email,
      role:      user.role,
      bloodType: user.bloodType,
    })
  );
});

// ══════════════════════════════════════════════════════
//  POST /auth/login
//  Login with VPN check on every attempt
// ══════════════════════════════════════════════════════
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, location } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  // ── VPN check ──────────────────────────────────────
  if (location) {
    const ip = (req.ip || "").replace("::ffff:", "");
    const { isVpn, reason } = detectVpn(location, ip);
    if (isVpn) {
      throw new ApiError(403, `Login blocked. ${reason}`);
    }
  }

  // ── Find user ──────────────────────────────────────
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash"
  );

  if (!user) throw new ApiError(401, "Invalid email or password");

  if (!user.isActive) {
    throw new ApiError(403, "Your account has been deactivated. Contact support.");
  }

  // ── Account lock check ─────────────────────────────
  if (
    user.security.lockedUntil &&
    user.security.lockedUntil > new Date()
  ) {
    const minutes = Math.ceil(
      (user.security.lockedUntil.getTime() - Date.now()) / 60000
    );
    throw new ApiError(423, `Account locked. Try again in ${minutes} minute(s).`);
  }

  // ── Password check ─────────────────────────────────
  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    user.security.loginAttempts += 1;
    if (user.security.loginAttempts >= 5) {
      user.security.lockedUntil   = new Date(Date.now() + 15 * 60 * 1000);
      user.security.loginAttempts = 0;
    }
    await user.save();

    await UserActivity.create({
      userId:    user._id,
      event:     "login_failed",
      meta:      { attempts: user.security.loginAttempts },
      ip:        req.ip,
      userAgent: req.headers["user-agent"] || "",
      timestamp: new Date(),
    }).catch(() => {});

    throw new ApiError(401, "Invalid email or password");
  }

  // ── Update security on success ─────────────────────
  user.security.loginAttempts   = 0;
  user.security.lockedUntil     = null;
  user.security.lastLoginAt     = new Date();
  user.security.lastLoginIp     = req.ip || null;
  user.security.lastLoginDevice = req.headers["user-agent"]?.substring(0, 100) || null;
  user.security.activeSessions += 1;
  await user.save();

  // ── Tokens ─────────────────────────────────────────
  const accessToken  = generateAccessToken(String(user._id), user.role);
  const refreshToken = generateRefreshToken(String(user._id));

  // ── Session ────────────────────────────────────────
  const ip       = (req.ip || "").replace("::ffff:", "");
  const uaString = req.headers["user-agent"] || "";
  const { device, browser } = parseDevice(uaString);
  const ipLoc    = getIpLocation(ip);

  const session = await Session.create({
    userId: user._id,
    device,
    browser,
    network: {
      ip,
      ipv6:          null,
      type:          "unknown",
      effectiveType: "unknown",
      downlink:      null,
      isp:           null,
      proxy:         false,
      vpn:           false,
      tor:           false,
    },
    location: {
      country:     ipLoc.country,
      countryCode: ipLoc.country,
      division:    ipLoc.state,
      district:    ipLoc.state,
      city:        ipLoc.city,
      timezone:    "",
      coordinates: ipLoc.coordinates,
      accuracy:    "city-level",
    },
    token:          accessToken,
    refreshToken,
    tokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    loginMethod:    "email",
    isActive:       true,
    lastActiveAt:   new Date(),
  });

  // ── Log activity ───────────────────────────────────
  await UserActivity.create({
    userId:    user._id,
    sessionId: session._id,
    event:     "login",
    meta:      { method: "email", device: device.type, city: ipLoc.city },
    ip,
    userAgent: uaString,
    timestamp: new Date(),
  }).catch(() => {});

  res.cookie("refreshToken", refreshToken, cookieOptions);

  res.status(200).json(
    new ApiResponse(200, "Logged in successfully", {
      accessToken,
      user: {
        id:              user._id,
        name:            user.name,
        email:           user.email,
        phone:           user.phone,
        role:            user.role,
        avatar:          user.avatar,
        bloodType:       user.bloodType,
        isAvailable:     user.isAvailable,
        isVerified:      user.isVerified,
        isDonorVerified: user.isDonorVerified,
        location:        user.location,
      },
    })
  );
});

// ══════════════════════════════════════════════════════
//  POST /auth/logout
// ══════════════════════════════════════════════════════
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const userId    = (req as any).user?.id;
  const sessionId = (req as any).user?.sessionId;

  await Session.findByIdAndUpdate(sessionId, {
    $set: { isActive: false, loggedOutAt: new Date() },
  });

  await User.findByIdAndUpdate(userId, {
    $inc: { "security.activeSessions": -1 },
  });

  await UserActivity.create({
    userId,
    sessionId,
    event:     "logout",
    meta:      {},
    ip:        req.ip,
    userAgent: req.headers["user-agent"] || "",
    timestamp: new Date(),
  }).catch(() => {});

  res.clearCookie("refreshToken");
  res.status(200).json(new ApiResponse(200, "Logged out successfully"));
});

// ══════════════════════════════════════════════════════
//  POST /auth/refresh-token
// ══════════════════════════════════════════════════════
export const refreshAccessToken = asyncHandler(
  async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken;

    if (!token) throw new ApiError(401, "No refresh token provided");

    let decoded: any;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    const session = await Session.findOne({
      userId: decoded.id,
      isActive: true,
    });

    if (!session) {
      throw new ApiError(401, "Session expired. Please log in again.");
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      throw new ApiError(401, "User not found or deactivated");
    }

    const newAccessToken = generateAccessToken(String(user._id), user.role);

    await Session.findByIdAndUpdate(session._id, {
      $set: {
        token:          newAccessToken,
        tokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        lastActiveAt:   new Date(),
      },
    });

    res.status(200).json(
      new ApiResponse(200, "Token refreshed", { accessToken: newAccessToken })
    );
  }
);

// ══════════════════════════════════════════════════════
//  POST /auth/forgot-password
// ══════════════════════════════════════════════════════
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) throw new ApiError(400, "Email is required");

    const user = await User.findOne({ email: email.toLowerCase() });

    const successMsg =
      "If this email is registered, a reset link has been sent";

    if (!user) {
      res.status(200).json(new ApiResponse(200, successMsg));
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    resetTokenStore.set(resetToken, {
      userId:    String(user._id),
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

    await sendEmail({
      to:      user.email,
      subject: "BloodConnect — Password Reset",
      html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${user.name},</p>
        <p>Click the button below to reset your password. This link expires in <strong>30 minutes</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 28px;background:#e53e3e;
                  color:white;border-radius:6px;text-decoration:none;margin:16px 0">
          Reset Password
        </a>
        <p>If you did not request this, please ignore this email.</p>
        <p>— BloodConnect Team</p>
      `,
    });

    res.status(200).json(new ApiResponse(200, successMsg));
  }
);

// ══════════════════════════════════════════════════════
//  POST /auth/reset-password
// ══════════════════════════════════════════════════════
export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      throw new ApiError(400, "Token and new password are required");
    }

    if (newPassword.length < 8) {
      throw new ApiError(400, "Password must be at least 8 characters");
    }

    const record = resetTokenStore.get(token);

    if (!record || Date.now() > record.expiresAt) {
      resetTokenStore.delete(token);
      throw new ApiError(400, "Reset token is invalid or has expired");
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await User.findByIdAndUpdate(record.userId, {
      $set: {
        passwordHash:                 hashed,
        "security.passwordChangedAt": new Date(),
        "security.loginAttempts":     0,
        "security.lockedUntil":       null,
        "security.activeSessions":    0,
      },
    });

    await Session.updateMany(
      { userId: record.userId, isActive: true },
      { $set: { isActive: false, loggedOutAt: new Date() } }
    );

    resetTokenStore.delete(token);

    await UserActivity.create({
      userId:    record.userId,
      event:     "password_reset",
      meta:      {},
      ip:        req.ip,
      userAgent: req.headers["user-agent"] || "",
      timestamp: new Date(),
    }).catch(() => {});

    res.status(200).json(
      new ApiResponse(
        200,
        "Password reset successfully. Please log in again."
      )
    );
  }
);

// ══════════════════════════════════════════════════════
//  GET /auth/me
//  Lightweight current user check for frontend
// ══════════════════════════════════════════════════════
export const getAuthUser = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    const user = await User.findById(userId).select(
      "name email phone avatar role bloodType isVerified isDonorVerified isAvailable location"
    );

    if (!user) throw new ApiError(401, "Unauthorized");

    res.status(200).json(new ApiResponse(200, "Authenticated user", user));
  }
);