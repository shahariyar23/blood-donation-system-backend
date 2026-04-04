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
  // ── Private helpers ──────────────────────────────────

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

  static detectVpn(frontendLocation: Record<string, any>, ip: string) {
    const ipLoc = this.getIpLocation(ip);
    if (!ipLoc.country) return { isVpn: false };

    const fCountry = (frontendLocation.country_code || "").toUpperCase();
    const iCountry = (ipLoc.country || "").toUpperCase();
    const fCity = (frontendLocation.city || "").toLowerCase();
    const fState = (frontendLocation.state || "").toLowerCase();
    const iCity = (ipLoc.city || "").toLowerCase();
    const iState = (ipLoc.state || "").toLowerCase();

    if (fCountry && iCountry && fCountry !== iCountry) {
      return {
        isVpn: true,
        reason: `Country mismatch — device says "${fCountry}" but IP is from "${iCountry}"`,
      };
    }

    const cityMatch = fCity && iCity && fCity === iCity;
    const stateMatch = fState && iState && fState === iState;

    if (fCity && fState && !cityMatch && !stateMatch) {
      return {
        isVpn: true,
        reason: `Location mismatch — device (${fCity}, ${fState}) vs IP (${iCity}, ${iState}). Disable VPN.`,
      };
    }

    return { isVpn: false };
  }

  // ════════════════════════════════════════════════════
  //  register
  // ════════════════════════════════════════════════════
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

    // VPN check
    const { isVpn, reason } = this.detectVpn(location, ip);
    if (isVpn) throw new ApiError(403, `Registration blocked. ${reason}`);

    // Duplicate check
    const [emailExists, phoneExists] = await Promise.all([
      User.findOne({ email: email.toLowerCase() }),
      User.findOne({ phone }),
    ]);
    if (emailExists) throw new ApiError(409, "Email is already registered");
    if (phoneExists) throw new ApiError(409, "Phone is already registered");

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      age: age || null,
      gender: gender || null,
      bloodType,
      weight: weight || null,
      role: "donor",
      isAvailable: false,
      isDonorVerified: false,
      location: {
        displayName: location.displayName,

        road: location.details.road || "",
        quarter: location.details.quarter || "",
        suburb: location.details.suburb || "",

        city: location.details.city || location.details.county || "",
        county: location.details.county || "",

        state_district: location.details.state_district || "",
        state: location.details.state || "",

        postcode: location.details.postcode || "",

        country: location.details.country || "",
        country_code: location.details.country_code?.toUpperCase() || "",

        coordinates: {
          lat: location.latitude,
          lng: location.longitude,
        },
      },
      socialLinks: {
        facebook: socialLinks?.facebook || null,
        instagram: socialLinks?.instagram || null,
        twitter: socialLinks?.twitter || null,
      },
    });

    // Log activity
    await UserActivity.create({
      userId: user._id,
      event: "register",
      meta: { bloodType: user.bloodType },
      ip,
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

  // ════════════════════════════════════════════════════
  //  login
  // ════════════════════════════════════════════════════
  static async login(body: any, ip: string, userAgent: string) {
    const { identifier, password, location } = body;
    console.log(identifier, password, location, "body")

    // VPN check
    if (location) {
      const { isVpn, reason } = this.detectVpn(
        location,
        ip.replace("::ffff:", ""),
      );
      if (isVpn) throw new ApiError(403, `Login blocked. ${reason}`);
    }

    // detect identifier type
    const isEmail = identifier.includes("@");

    const query = isEmail
      ? { email: identifier.toLowerCase() }
      : { phone: identifier };

    // Find user
    const user = await User.findOne(query).select("+passwordHash");

    if (!user) throw new ApiError(401, "Invalid email or phone or password");

    if (!user.isActive) {
      throw new ApiError(403, "Account deactivated. Contact support.");
    }
    // Lock check
    if (user.security.lockedUntil && user.security.lockedUntil > new Date()) {
      const mins = Math.ceil(
        (user.security.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ApiError(
        423,
        `Account locked. Try again in ${mins} minute(s).`,
      );
    }

    // Password check
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
        ip,
        userAgent,
        timestamp: new Date(),
      }).catch(() => {});
      throw new ApiError(401, "Invalid email or password");
    }

    // Update security + location
    user.security.loginAttempts = 0;
    user.security.lockedUntil = null;
    user.security.lastLoginAt = new Date();
    user.security.lastLoginIp = ip;
    user.security.lastLoginDevice = userAgent?.substring(0, 100) || null;
    user.security.activeSessions += 1;

    if (location) {
      user.location = {
        displayName: location.displayName,

        road: location.road || "",
        quarter: location.quarter || "",
        suburb: location.suburb || "",

        city: location.city || location.county || "",
        county: location.county || "",

        state_district: location.state_district || "",
        state: location.state || "",

        postcode: location.postcode || "",

        country: location.country || "",
        country_code: location.country_code?.toUpperCase() || "",

        coordinates: {
          lat: location.coordinates?.lat,
          lng: location.coordinates?.lng,
        },
      };
    }

    await user.save();

    // Tokens
    const accessToken = generateAccessToken(String(user._id), user.role);
    const refreshToken = generateRefreshToken(String(user._id));

    // Session
    const cleanIp = ip.replace("::ffff:", "");
    const { device, browser } = this.parseDevice(userAgent);
    const ipLoc = this.getIpLocation(cleanIp);

   try {
     const session = await Session.create({
      userId: user._id,
      device,
      browser,
      network: {
        ip: cleanIp,
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
      tokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      loginMethod: "email",
      isActive: true,
      lastActiveAt: new Date(),
    });
    // Log activity
    await UserActivity.create({
      userId: user._id,
      sessionId: session._id,
      event: "login",
      meta: { method: "email", device: device.type },
      ip: cleanIp,
      userAgent,
      timestamp: new Date(),
    }).catch(() => {});
    console.log("create session ");
    
   } catch (error) {
    console.log("from session: ", error)
   }

    

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

  // ════════════════════════════════════════════════════
  //  logout
  // ════════════════════════════════════════════════════
  static async logout(
    userId: string,
    sessionId: string,
    ip: string,
    userAgent: string,
  ) {
    await Session.findByIdAndUpdate(sessionId, {
      $set: { isActive: false, loggedOutAt: new Date() },
    });
    await User.findByIdAndUpdate(userId, {
      $inc: { "security.activeSessions": -1 },
    });
    await UserActivity.create({
      userId,
      sessionId,
      event: "logout",
      meta: {},
      ip,
      userAgent,
      timestamp: new Date(),
    }).catch(() => {});
  }

  // ════════════════════════════════════════════════════
  //  refreshAccessToken
  // ════════════════════════════════════════════════════
  static async refreshAccessToken(token: string) {
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
    if (!session)
      throw new ApiError(401, "Session expired. Please log in again.");

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive)
      throw new ApiError(401, "User not found or deactivated");

    const newAccessToken = generateAccessToken(String(user._id), user.role);

    await Session.findByIdAndUpdate(session._id, {
      $set: {
        token: newAccessToken,
        tokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        lastActiveAt: new Date(),
      },
    });

    return { accessToken: newAccessToken };
  }

  // ════════════════════════════════════════════════════
  //  forgotPassword
  // ════════════════════════════════════════════════════
  static async forgotPassword(email: string, clientUrl: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return;

    // generate token
    const resetToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await User.findByIdAndUpdate(user._id, {
      passwordResetToken: hashedToken, // ✅ MUST be hashed
      passwordResetExpires: new Date(Date.now() + 30 * 60 * 1000),
    });
    console.log("Reset token: ", resetToken);
    // save hashed token + expiry to user document
    // await User.findByIdAndUpdate(user._id, {
    //   $set: {
    //     passwordResetToken:   hashedToken,
    //     passwordResetExpires: new Date(Date.now() + 30 * 60 * 1000),
    //   },
    // });

    // send raw token in email (user gets the unhashed version)
    const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: "BloodConnect — Password Reset",
      html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${user.name},</p>
        <p>Click below to reset your password. Expires in <strong>30 minutes</strong>.</p>
        <a href="${resetUrl}"
          style="display:inline-block;padding:12px 28px;background:#e53e3e;
                  color:white;border-radius:6px;text-decoration:none;margin:16px 0">
          Reset Password
        </a>
        <p>If you didn't request this, ignore this email.</p>
      `,
    });
  }

  // ════════════════════════════════════════════════════
  //  resetPassword
  // ════════════════════════════════════════════════════
  static async resetPassword(
    token: string,
    newPassword: string,
    ip: string,
    userAgent: string,
  ) {
    // 1. Hash the incoming token (VERY IMPORTANT)
    token = token.trim();

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const debugUser = await User.findOne({ email: "mostak@gmail.com" }).select(
      "+passwordResetToken +passwordResetExpires",
    );

    console.log("DB token: ", debugUser?.passwordResetToken);
    console.log("HASHED:   ", hashedToken);

    // 2. Find user with matching hashed token + valid expiry
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      throw new ApiError(400, "Reset token is invalid or has expired");
    }

    // 3. Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // 4. Update user password + security fields
    await User.findByIdAndUpdate(user._id, {
      $set: {
        passwordHash,
        "security.passwordChangedAt": new Date(),
        "security.loginAttempts": 0,
        "security.lockedUntil": null,
        "security.activeSessions": 0,

        // Clear reset token fields
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // 5. Invalidate all active sessions
    await Session.updateMany(
      { userId: user._id, isActive: true },
      {
        $set: {
          isActive: false,
          loggedOutAt: new Date(),
        },
      },
    );

    // 6. Log activity (non-blocking)
    await UserActivity.create({
      userId: user._id,
      event: "password_reset",
      meta: {},
      ip,
      userAgent,
      timestamp: new Date(),
    }).catch(() => {});
  }
}
