import bcrypt from "bcrypt";
import crypto from "crypto";
import UAParser from "ua-parser-js";
import geoip from "geoip-lite";
import User from "../user/User.schema";
import Session from "./Session.schema";
import UserActivity from "../user/UserActivity.schema";
import {
  ApiError,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  sendEmail,
} from "../../shared/utils";

export class AuthService {
  // ══════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ══════════════════════════════════════════════════════

  // ── Parse device + browser from user-agent ───────────
  private static parseDevice(userAgent: string) {
    const parser = new UAParser(userAgent);
    const r = parser.getResult();
    return {
      device: {
        type: r.device.type || "desktop",
        brand: r.device.vendor || "unknown",
        model: r.device.model || "unknown",
        os: r.os.name || "unknown",
        osVersion: r.os.version || "unknown",
      },
      browser: {
        name: r.browser.name || "unknown",
        version: r.browser.version || "unknown",
        engine: r.engine.name || "unknown",
        language: "unknown",
        cookiesEnabled: false,
        doNotTrack: false,
        userAgent,
      },
    };
  }

  // ── Get real location from IP via geoip-lite ─────────
  private static getIpLocation(ip: string) {
    const geo = geoip.lookup(ip.replace("::ffff:", ""));
    return {
      country: geo?.country || "",
      city: geo?.city || "",
      state: geo?.region || "",
      coordinates: {
        lat: geo?.ll?.[0] ?? null,
        lng: geo?.ll?.[1] ?? null,
      },
    };
  }

  // ── Clean IP helper ───────────────────────────────────
  private static cleanIp(ip: string): string {
    return ip.replace("::ffff:", "");
  }

  // ══════════════════════════════════════════════════════
  //  VPN DETECTION
  //  Frontend sends location → compare with IP location
  //  If country OR city+state both mismatch → VPN detected
  // ══════════════════════════════════════════════════════
  static detectVpn(
    frontendLocation: Record<string, any>,
    ip: string,
  ): { isVpn: boolean; reason?: string } {
    const ipLoc = this.getIpLocation(ip);

    // skip for localhost / private IPs (dev environment)
    if (!ipLoc.country) return { isVpn: false };

    const fCountry = (frontendLocation.country_code || "").toUpperCase().trim();
    const iCountry = (ipLoc.country || "").toUpperCase().trim();
    const fCity = (frontendLocation.city || "").toLowerCase().trim();
    const fState = (frontendLocation.state || "").toLowerCase().trim();
    const iCity = (ipLoc.city || "").toLowerCase().trim();
    const iState = (ipLoc.state || "").toLowerCase().trim();

    // Rule 1 — country must match
    if (fCountry && iCountry && fCountry !== iCountry) {
      return {
        isVpn: true,
        reason: `Country mismatch — device says "${fCountry}" but IP is from "${iCountry}". VPN or proxy is not allowed.`,
      };
    }

    // Rule 2 — city AND state both mismatch → VPN
    const cityMatch = fCity && iCity && fCity === iCity;
    const stateMatch = fState && iState && fState === iState;

    if (fCity && fState && !cityMatch && !stateMatch) {
      return {
        isVpn: true,
        reason: `Location mismatch — device (${fCity}, ${fState}) vs IP location (${iCity}, ${iState}). Please disable your VPN or proxy.`,
      };
    }

    return { isVpn: false };
  }

  // ══════════════════════════════════════════════════════
  //  REGISTER
  //  All users are donors
  // ══════════════════════════════════════════════════════
  static async register(body: any, ip: string, userAgent: string) {
    const {
      name,
      email,
      phone,
      password,
      bloodType,
      age,
      gender,
      weight,
      dateOfBirth,
      location,
      socialLinks,
    } = body;

    // ── VPN check ──────────────────────────────────────
    const { isVpn, reason } = this.detectVpn(location, this.cleanIp(ip));
    if (isVpn) throw new ApiError(403, `Registration blocked. ${reason}`);

    // ── Duplicate check ────────────────────────────────
    const [emailExists, phoneExists] = await Promise.all([
      User.findOne({ email: email.toLowerCase() }),
      User.findOne({ phone }),
    ]);
    if (emailExists) throw new ApiError(409, "Email is already registered");
    if (phoneExists) throw new ApiError(409, "Phone is already registered");

    // ── Hash password ──────────────────────────────────
    const passwordHash = await bcrypt.hash(password, 12);

    // ── Build location from frontend data ─────────────
    const userLocation = {
      displayName: location.displayName || "",
      road: location.road || "",
      quarter: location.quarter || "",
      suburb: location.suburb || "",
      city: location.city || location.county || "",
      county: location.county || "",
      state_district: location.state_district || "",
      state: location.state || "",
      postcode: location.postcode || "",
      country: location.country || "",
      country_code: (location.country_code || "").toUpperCase(),
      coordinates: {
        lat: location.coordinates?.lat ?? null,
        lng: location.coordinates?.lng ?? null,
      },
    };

    // ── Create user ────────────────────────────────────
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      age: age || null,
      gender: gender || null,
      bloodType,
      weight: weight || null,
      dateOfBirth: dateOfBirth || null,
      role: "donor",
      isAvailable: false,
      isDonorVerified: false,
      totalDonations: 0,
      lastDonationDate: null,
      location: userLocation,
      socialLinks: {
        facebook: socialLinks?.facebook || null,
        instagram: socialLinks?.instagram || null,
        twitter: socialLinks?.twitter || null,
      },
    });

    // ── Log activity ───────────────────────────────────
    await UserActivity.create({
      userId: user._id,
      event: "register",
      meta: { bloodType: user.bloodType, city: userLocation.city },
      ip: this.cleanIp(ip),
      userAgent,
      timestamp: new Date(),
    }).catch(() => {});

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      bloodType: user.bloodType,
    };
  }

  // ══════════════════════════════════════════════════════
  //  LOGIN
  //  Supports email OR phone as identifier
  // ══════════════════════════════════════════════════════
  static async login(body: any, ip: string, userAgent: string) {
    const { identifier, password, location } = body;

    const cleanedIp = this.cleanIp(ip);

    // ── VPN check ──────────────────────────────────────
    if (location) {
      const { isVpn, reason } = this.detectVpn(location, cleanedIp);
      if (isVpn) throw new ApiError(403, `Login blocked. ${reason}`);
    }

    // ── Detect identifier type — email or phone ────────
    const isEmail = identifier.includes("@");
    const query = isEmail
      ? { email: identifier.toLowerCase() }
      : { phone: identifier };

    // ── Find user ──────────────────────────────────────
    const user = await User.findOne(query).select("+passwordHash");

    if (!user) {
      throw new ApiError(401, "Invalid credentials");
    }

    if (!user.isActive) {
      throw new ApiError(403, "Account deactivated. Contact support.");
    }

    // ── Account lock check ─────────────────────────────
    if (user.security.lockedUntil && user.security.lockedUntil > new Date()) {
      const mins = Math.ceil(
        (user.security.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ApiError(
        423,
        `Account locked. Try again in ${mins} minute(s).`,
      );
    }

    // ── Password check ─────────────────────────────────
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      user.security.loginAttempts += 1;

      if (user.security.loginAttempts >= 5) {
        user.security.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.security.loginAttempts = 0;
      }

      await user.save();

      await UserActivity.create({
        userId: user._id,
        event: "login_failed",
        meta: { attempts: user.security.loginAttempts },
        ip: cleanedIp,
        userAgent,
        timestamp: new Date(),
      }).catch(() => {});

      throw new ApiError(401, "Invalid credentials");
    }

    // ── Reset security fields on success ───────────────
    user.security.loginAttempts = 0;
    user.security.lockedUntil = null;
    user.security.lastLoginAt = new Date();
    user.security.lastLoginIp = cleanedIp;
    user.security.lastLoginDevice = userAgent?.substring(0, 100) || null;
    user.security.activeSessions += 1;

    // ── Update location on every login ─────────────────
    if (location) {
      user.location = {
        displayName: location.displayName || user.location.displayName,
        road: location.road || user.location.road,
        quarter: location.quarter || user.location.quarter,
        suburb: location.suburb || user.location.suburb,
        city: location.city || user.location.city,
        county: location.county || user.location.county,
        state_district: location.state_district || user.location.state_district,
        state: location.state || user.location.state,
        postcode: location.postcode || user.location.postcode,
        country: location.country || user.location.country,
        country_code: (
          location.country_code ||
          user.location.country_code ||
          ""
        ).toUpperCase(),
        coordinates: {
          lat: location.coordinates?.lat ?? user.location.coordinates.lat,
          lng: location.coordinates?.lng ?? user.location.coordinates.lng,
        },
      };
    }

    await user.save();

    // ── Generate tokens ────────────────────────────────
    const accessToken = generateAccessToken(String(user._id), user.role);
    const refreshToken = generateRefreshToken(String(user._id));

    // ── Parse device + browser ─────────────────────────
    const { device, browser } = this.parseDevice(userAgent);

    // ── Get IP location for session ────────────────────
    const ipLoc = this.getIpLocation(cleanedIp);

    // ── Create session ─────────────────────────────────
    const session = await Session.create({
      userId: user._id,
      device,
      browser,
      network: {
        ip: cleanedIp,
        ipv6: null,
        type: "unknown",
        effectiveType: "unknown",
        downlink: null,
        isp: null,
        proxy: false,
        vpn: false,
        tor: false,
      },
      location: {
        country: ipLoc.country,
        countryCode: ipLoc.country,
        division: ipLoc.state,
        district: ipLoc.state,
        city: ipLoc.city,
        timezone: "",
        coordinates: ipLoc.coordinates,
        accuracy: "city-level",
      },
      token: accessToken,
      refreshToken,
      tokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      loginMethod: isEmail ? "email" : "phone",
      isActive: true,
      lastActiveAt: new Date(),
    });

    // ── Log activity ───────────────────────────────────
    await UserActivity.create({
      userId: user._id,
      sessionId: session._id,
      event: "login",
      meta: { method: isEmail ? "email" : "phone", device: device.type },
      ip: cleanedIp,
      userAgent,
      timestamp: new Date(),
    }).catch(() => {});

    return {
      refreshToken,
      data: {
        accessToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          bloodType: user.bloodType,
          isAvailable: user.isAvailable,
          isVerified: user.isVerified,
          isDonorVerified: user.isDonorVerified,
          location: user.location,
        },
      },
    };
  }

  // ══════════════════════════════════════════════════════
  //  LOGOUT
  // ══════════════════════════════════════════════════════
  static async logout(
    userId: string,
    sessionId: string,
    ip: string,
    userAgent: string,
  ) {
    // ── Deactivate session ─────────────────────────────
    await Session.findByIdAndUpdate(sessionId, {
      $set: { isActive: false, loggedOutAt: new Date() },
    });

    // ── Decrement active session count ─────────────────
    await User.findByIdAndUpdate(userId, {
      $inc: { "security.activeSessions": -1 },
    });

    // ── Log activity ───────────────────────────────────
    await UserActivity.create({
      userId,
      sessionId,
      event: "logout",
      meta: {},
      ip: this.cleanIp(ip),
      userAgent,
      timestamp: new Date(),
    }).catch(() => {});
  }

  // ══════════════════════════════════════════════════════
  //  REFRESH ACCESS TOKEN
  //  Validates refresh token + session + issues new access token
  // ══════════════════════════════════════════════════════
  static async refreshAccessToken(token: string) {
    // ── Verify JWT signature ───────────────────────────
    let decoded: any;
    try {
      decoded = verifyRefreshToken(token);
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        throw new ApiError(
          401,
          "Refresh token has expired. Please log in again.",
        );
      }
      throw new ApiError(401, "Invalid refresh token");
    }

    // ── Find active session + select hidden fields ─────
    const session = await Session.findOne({
      userId: decoded.id,
      isActive: true,
    }).select("+token +refreshToken");

    if (!session) {
      throw new ApiError(401, "Session not found. Please log in again.");
    }

    // ── Check refresh token expiry ─────────────────────
    if (session.refreshTokenExpiresAt < new Date()) {
      await Session.findByIdAndUpdate(session._id, {
        $set: { isActive: false, loggedOutAt: new Date() },
      });
      throw new ApiError(
        401,
        "Refresh token has expired. Please log in again.",
      );
    }

    // ── Validate token matches the session ────────────
    if (session.refreshToken !== token) {
      throw new ApiError(401, "Refresh token mismatch. Please log in again.");
    }

    // ── Check user still exists ───────────────────────
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      throw new ApiError(401, "User not found or deactivated");
    }

    // ── Issue new access token ─────────────────────────
    const newAccessToken = generateAccessToken(String(user._id), user.role);

    // ── Update session ─────────────────────────────────
    await Session.findByIdAndUpdate(session._id, {
      $set: {
        token: newAccessToken,
        tokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        lastActiveAt: new Date(),
      },
    });

    return { accessToken: newAccessToken };
  }

  // ══════════════════════════════════════════════════════
  //  FORGOT PASSWORD
  //  Generates reset token → stores hashed in DB → sends raw in email
  // ══════════════════════════════════════════════════════
  static async forgotPassword(email: string, clientUrl: string) {
    const user = await User.findOne({ email: email.toLowerCase() });

    // always return silently — never reveal if email exists
    if (!user) return;

    // ── Check rate limit ───────────────────────────────
    if (
      user.security.lockedUntil &&
      user.security.lockedUntil > new Date()
    ) {
      const mins = Math.ceil(
        (user.security.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ApiError(
        429,
        `Too many reset attempts. Try again in ${mins} minute(s).`,
      );
    }

    // ── Increment attempts ─────────────────────────────
    user.security.loginAttempts = (user.passwordResetAttempts || 0) + 1;

    if (user.passwordResetAttempts >= 3) {
      user.passwordResetLockedUntil = new Date(Date.now() + 60 * 60 * 1000);
      user.passwordResetAttempts = 0;
      await user.save();
      throw new ApiError(429, "Too many reset attempts. Locked for 1 hour.");
    }

    await user.save();

    // ── Generate token ─────────────────────────────────
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // ── Save hashed token to DB ────────────────────────
    await User.findByIdAndUpdate(user._id, {
      $set: {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // ── Send raw token in email ────────────────────────
    const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: "BloodConnect — Password Reset",
      html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${user.name},</p>
        <p>
          You have <strong>${3 - user.passwordResetAttempts} attempt(s)</strong>
          remaining before lockout.
        </p>
        <p>Click below to reset your password. Expires in <strong>30 minutes</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 28px;background:#e53e3e;
                  color:white;border-radius:6px;text-decoration:none;margin:16px 0">
          Reset Password
        </a>
        <p>If you didn't request this, ignore this email.</p>
        <p>— BloodConnect Team</p>
      `,
    });
  }

  // ══════════════════════════════════════════════════════
  //  RESET PASSWORD
  //  Hashes incoming token → finds matching user → resets
  // ══════════════════════════════════════════════════════
  static async resetPassword(
    token: string,
    newPassword: string,
    ip: string,
    userAgent: string,
  ) {
    // ── Hash incoming token to compare with DB ─────────
    const hashedToken = crypto
      .createHash("sha256")
      .update(token.trim())
      .digest("hex");

    // ── Find user with valid token ─────────────────────
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      throw new ApiError(400, "Reset token is invalid or has expired");
    }

    // ── Hash new password ──────────────────────────────
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // ── Update user ────────────────────────────────────
    await User.findByIdAndUpdate(user._id, {
      $set: {
        passwordHash,
        "security.passwordChangedAt": new Date(),
        "security.loginAttempts": 0,
        "security.lockedUntil": null,
        "security.activeSessions": 0,

        // clear reset fields
        passwordResetToken: null,
        passwordResetExpires: null,
        passwordResetAttempts: 0,
        passwordResetLockedUntil: null,
      },
    });

    // ── Invalidate all active sessions ─────────────────
    await Session.updateMany(
      { userId: user._id, isActive: true },
      { $set: { isActive: false, loggedOutAt: new Date() } },
    );

    // ── Log activity ───────────────────────────────────
    await UserActivity.create({
      userId: user._id,
      event: "password_reset",
      meta: {},
      ip: this.cleanIp(ip),
      userAgent,
      timestamp: new Date(),
    }).catch(() => {});
  }
}
