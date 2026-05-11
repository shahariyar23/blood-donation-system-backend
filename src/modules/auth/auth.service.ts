import bcrypt from "bcrypt";
import crypto from "crypto";
import UAParser from "ua-parser-js";
import geoip from "geoip-lite";
import {
  User,
  DeletedUser,
  Session,
  UserActivity,
  Donor,
} from "../index";
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

  // ── Keep stored active session count in sync ─────────
  private static async syncActiveSessionCount(userId: string) {
    const activeSessions = await Session.countDocuments({
      userId,
      isActive: true,
    });

    await User.findByIdAndUpdate(userId, {
      $set: { "security.activeSessions": activeSessions },
    });

    return activeSessions;
  }

  private static generateOtpCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  private static hashOtp(code: string): string {
    return crypto.createHash("sha256").update(code).digest("hex");
  }

  private static async issueEmailVerificationOtp(
    user: any,
    ip: string,
    userAgent: string,
  ) {
    const code = this.generateOtpCode();
    const codeHash = this.hashOtp(code);

    user.emailVerificationCode = codeHash;
    user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.emailVerificationAttempts = 0;
    user.emailVerificationBlockedUntil = null;
    await user.save();

    await sendEmail({
      to: user.email,
      subject: "BloodConnect — Verify your email",
      html: `
        <h2>Email Verification</h2>
        <p>Hi ${user.name},</p>
        <p>Your verification code is:</p>
        <div style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</div>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p>— BloodConnect Team</p>
      `,
    });

    await UserActivity.create({
      userId: user._id,
      event: "profile_update",
      meta: { action: "send_email_otp" },
      ip,
      userAgent,
      timestamp: new Date(),
    }).catch(() => {});

    return { email: user.email, expiresAt: user.emailVerificationExpires };
  }

  // ── Session helpers for frontend settings page ───────
  private static formatSessionDevice(session: any) {
    const browserName = session.browser?.name || "Unknown browser";
    const deviceModel = session.device?.model;
    const deviceBrand = session.device?.brand;
    const deviceType = session.device?.type;
    const osName = session.device?.os;

    const hardwareLabel =
      (deviceModel && deviceModel !== "unknown" && deviceModel) ||
      (deviceBrand && deviceBrand !== "unknown" && deviceBrand) ||
      (deviceType &&
        deviceType !== "unknown" &&
        deviceType.charAt(0).toUpperCase() + deviceType.slice(1)) ||
      (osName && osName !== "unknown" && osName) ||
      "Unknown device";

    return `${hardwareLabel} · ${browserName}`;
  }

  private static formatSessionLocation(session: any) {
    const city =
      session.location?.city ||
      session.location?.district ||
      session.location?.division ||
      "Unknown";

    const country =
      session.location?.countryCode || session.location?.country || "";

    return country ? `${city}, ${country}` : city;
  }

  private static formatLastActive(lastActiveAt: Date) {
    const diffMs = Date.now() - new Date(lastActiveAt).getTime();

    if (diffMs < 60 * 1000) return "Now";

    const minutes = Math.floor(diffMs / (60 * 1000));
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

    return new Date(lastActiveAt).toISOString();
  }

  private static mapSessionForResponse(session: any, currentSessionId: string) {
    return {
      id: String(session._id),
      device: this.formatSessionDevice(session),
      location: this.formatSessionLocation(session),
      lastActive: this.formatLastActive(session.lastActiveAt),
      lastActiveAt: session.lastActiveAt,
      current: String(session._id) === currentSessionId,
      loginMethod: session.loginMethod,
      browser: {
        name: session.browser?.name || "unknown",
        version: session.browser?.version || "unknown",
        engine: session.browser?.engine || "unknown",
      },
      deviceDetails: {
        type: session.device?.type || "unknown",
        brand: session.device?.brand || "unknown",
        model: session.device?.model || "unknown",
        os: session.device?.os || "unknown",
        osVersion: session.device?.osVersion || "unknown",
      },
      network: {
        ip: session.network?.ip || "",
        type: session.network?.type || "unknown",
        effectiveType: session.network?.effectiveType || "unknown",
      },
      createdAt: session.createdAt,
    };
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
      avatar,
      password,
      bloodType,
      age,
      gender,
      weight,
      dateOfBirth,
      isAvailable,
      totalDonations,
      lastDonationDate,
      location,
      socialLinks,
      role,
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
      avatar: avatar || null,
      age: age || null,
      gender: gender || null,
      bloodType,
      weight: weight || null,
      dateOfBirth,
      role,
      isVerified: false,
      location: userLocation,
      socialLinks: {
        facebook: socialLinks?.facebook || null,
        instagram: socialLinks?.instagram || null,
        twitter: socialLinks?.twitter || null,
      },
    });

    // ── Create donor if requested + send OTP ───────────
    try {
      if (role == "donor") {
        const donations = typeof totalDonations === "number" ? totalDonations : 0;
        const lastDonation = donations > 0 ? lastDonationDate || null : null;
        const nextAvailableAt = lastDonation
          ? new Date(new Date(lastDonation).getTime() + 90 * 24 * 60 * 60 * 1000)
          : null;
        const isCurrentlyAvailable = nextAvailableAt
          ? new Date() >= nextAvailableAt
          : typeof isAvailable === "boolean"
            ? isAvailable
            : false;

        await Donor.create({
          userId: user._id,
          isAvailable: isCurrentlyAvailable,
          totalDonations: donations,
          lastDonationDate: lastDonation,
          nextAvailableAt,
          isVerified: false,
        });
      }

      await this.issueEmailVerificationOtp(user, this.cleanIp(ip), userAgent);
    } catch (error) {
      await Donor.deleteOne({ userId: user._id });
      await User.findByIdAndDelete(user._id);
      throw new ApiError(
        500,
        "Failed to create account. Please try again.",
      );
    }

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
      emailVerificationSent: true,
    };
  }

  // ══════════════════════════════════════════════════════
  //  SEND EMAIL OTP
  // ══════════════════════════════════════════════════════
  static async sendEmailVerificationOtp(
    email: string,
    ip: string,
    userAgent: string,
  ) {
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+emailVerificationCode +emailVerificationExpires +emailVerificationAttempts +emailVerificationBlockedUntil",
    );

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (user.isVerified) {
      throw new ApiError(400, "Email is already verified");
    }

    if (
      user.emailVerificationBlockedUntil &&
      user.emailVerificationBlockedUntil > new Date()
    ) {
      const mins = Math.ceil(
        (user.emailVerificationBlockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ApiError(429, `Too many attempts. Try again in ${mins} minute(s).`);
    }

    return this.issueEmailVerificationOtp(user, this.cleanIp(ip), userAgent);
  }

  // ══════════════════════════════════════════════════════
  //  VERIFY EMAIL OTP
  // ══════════════════════════════════════════════════════
  static async verifyEmailOtp(
    email: string,
    otp: string,
    ip: string,
    userAgent: string,
  ) {
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+emailVerificationCode +emailVerificationExpires +emailVerificationAttempts +emailVerificationBlockedUntil",
    );

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (user.isVerified) {
      return { id: user._id, email: user.email, isVerified: true };
    }

    if (!user.emailVerificationCode || !user.emailVerificationExpires) {
      throw new ApiError(400, "No OTP found. Please request a new one.");
    }

    if (
      user.emailVerificationBlockedUntil &&
      user.emailVerificationBlockedUntil > new Date()
    ) {
      const mins = Math.ceil(
        (user.emailVerificationBlockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ApiError(429, `Too many attempts. Try again in ${mins} minute(s).`);
    }

    if (user.emailVerificationExpires < new Date()) {
      user.emailVerificationCode = null;
      user.emailVerificationExpires = null;
      user.emailVerificationAttempts = 0;
      await user.save();
      throw new ApiError(400, "OTP expired. Please request a new one.");
    }

    const otpHash = this.hashOtp(otp);
    if (otpHash !== user.emailVerificationCode) {
      user.emailVerificationAttempts += 1;

      if (user.emailVerificationAttempts >= 5) {
        user.emailVerificationBlockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await user.save();
      throw new ApiError(400, "Invalid OTP");
    }

    user.isVerified = true;
    user.emailVerificationCode = null;
    user.emailVerificationExpires = null;
    user.emailVerificationAttempts = 0;
    user.emailVerificationBlockedUntil = null;
    await user.save();

    await UserActivity.create({
      userId: user._id,
      event: "profile_update",
      meta: { action: "verify_email" },
      ip: this.cleanIp(ip),
      userAgent,
      timestamp: new Date(),
    }).catch(() => {});

    return { id: user._id, email: user.email, isVerified: true };
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
      throw new ApiError(401, "Your Password is wrong");
    }

    if (!user.isActive) {
      throw new ApiError(403, "Account deactivated. Contact support.");
    }

    if (!user.isVerified) {
      throw new ApiError(403, "Email not verified. Please verify your email.");
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

      throw new ApiError(401, "Your Password is wrong");
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

    await this.syncActiveSessionCount(String(user._id));

    const donor =
      user.role === "donor"
        ? await Donor.findOne({ userId: user._id }).select(
            "isAvailable totalDonations lastDonationDate isVerified",
          )
        : null;

    return {
      refreshToken,
      data: {
        accessToken,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          bloodType: user.bloodType,
          lastReceivedDate: user.lastReceivedDate ?? null,
          totalReceived: user.totalReceived ?? 0,
          isAvailable: donor?.isAvailable ?? false,
          isVerified: user.isVerified,
          isDonorVerified: donor?.isVerified ?? false,
          totalDonations: donor?.totalDonations ?? 0,
          lastDonationDate: donor?.lastDonationDate ?? null,
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

    await this.syncActiveSessionCount(userId);
  }

  // ══════════════════════════════════════════════════════
  //  GET MY ACTIVE SESSIONS
  // ══════════════════════════════════════════════════════
  static async getMySessions(userId: string, currentSessionId: string) {
    const sessions = await Session.find({
      userId,
      isActive: true,
    })
      .sort({ lastActiveAt: -1, createdAt: -1 })
      .select(
        "_id device browser network location loginMethod lastActiveAt createdAt",
      );

    return {
      totalSessions: sessions.length,
      currentSessionId,
      sessions: sessions.map((session) =>
        this.mapSessionForResponse(session, currentSessionId),
      ),
    };
  }

  // ══════════════════════════════════════════════════════
  //  LOGOUT ONE OTHER SESSION
  // ══════════════════════════════════════════════════════
  static async logoutSession(
    userId: string,
    targetSessionId: string,
    currentSessionId: string,
    ip: string,
    userAgent: string,
  ) {
    if (targetSessionId === currentSessionId) {
      throw new ApiError(
        400,
        "Use the normal logout endpoint to log out your current session.",
      );
    }

    const session = await Session.findOne({
      _id: targetSessionId,
      userId,
      isActive: true,
    }).select("_id");

    if (!session) {
      throw new ApiError(404, "Session not found");
    }

    await Session.findByIdAndUpdate(targetSessionId, {
      $set: { isActive: false, loggedOutAt: new Date() },
    });

    const activeSessions = await this.syncActiveSessionCount(userId);

    await UserActivity.create({
      userId,
      sessionId: session._id,
      event: "logout",
      meta: { scope: "single-other-session" },
      ip: this.cleanIp(ip),
      userAgent,
      timestamp: new Date(),
    }).catch(() => {});

    return {
      loggedOutSessionId: targetSessionId,
      activeSessions,
    };
  }

  // ══════════════════════════════════════════════════════
  //  LOGOUT ALL OTHER SESSIONS
  // ══════════════════════════════════════════════════════
  static async logoutOtherSessions(
    userId: string,
    currentSessionId: string,
    ip: string,
    userAgent: string,
  ) {
    const result = await Session.updateMany(
      {
        userId,
        isActive: true,
        _id: { $ne: currentSessionId },
      },
      {
        $set: { isActive: false, loggedOutAt: new Date() },
      },
    );

    const activeSessions = await this.syncActiveSessionCount(userId);

    await UserActivity.create({
      userId,
      sessionId: currentSessionId,
      event: "logout",
      meta: {
        scope: "all-other-sessions",
        loggedOutCount: result.modifiedCount || 0,
      },
      ip: this.cleanIp(ip),
      userAgent,
      timestamp: new Date(),
    }).catch(() => {});

    return {
      loggedOutCount: result.modifiedCount || 0,
      activeSessions,
    };
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
    // Since a user can have multiple active sessions (e.g. phone and laptop),
    // we need to find the specific session that matches this refresh token.
    const session = await Session.findOne({
      userId: decoded.id,
      refreshToken: token,
    }).select("+token +refreshToken +isActive +refreshTokenExpiresAt");

    if (!session) {
      throw new ApiError(401, "Session not found or token revoked. Please log in again.");
    }

    if (!session.isActive) {
      throw new ApiError(401, "Session has been logged out. Please log in again.");
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

    return {
      accessToken: newAccessToken,
      refreshToken: session.refreshToken,
      role: user.role,
    };
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
console.log(resetUrl)
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

  // ══════════════════════════════════════════════════════
  //  UPDATE AUTH USER
  // ══════════════════════════════════════════════════════
  static async updateAuthUser(userId: string, body: any) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    const allowedUpdates = [
      "name",
      "phone",
      "bloodType",
      "gender",
      "age",
      "weight",
      "dateOfBirth",
      "location",
      "socialLinks",
    ];

    allowedUpdates.forEach((field) => {
      if (body[field] !== undefined) {
        (user as any)[field] = body[field];
      }
    });

    await user.save();

    // Also update Donor collection if they are a donor
    if (user.role === "donor") {
      const donorUpdate: any = {};
      if (body.isAvailable !== undefined) donorUpdate.isAvailable = body.isAvailable;
      
      if (Object.keys(donorUpdate).length > 0) {
        await Donor.findOneAndUpdate({ userId: user._id }, { $set: donorUpdate });
      }
    }

    const refreshedUser = await User.findById(user._id).select(
      "name email phone avatar role bloodType isVerified location age weight gender dateOfBirth socialLinks lastReceivedDate totalReceived",
    );

    if (!refreshedUser) throw new ApiError(404, "User not found");

    const donor =
      refreshedUser.role === "donor"
        ? await Donor.findOne({ userId: refreshedUser._id }).select(
            "isAvailable totalDonations lastDonationDate isVerified",
          )
        : null;

    return {
      ...refreshedUser.toObject(),
      lastReceivedDate: refreshedUser.lastReceivedDate ?? null,
      totalReceived: refreshedUser.totalReceived ?? 0,
      isAvailable: donor?.isAvailable ?? false,
      isDonorVerified: donor?.isVerified ?? false,
      totalDonations: donor?.totalDonations ?? 0,
      lastDonationDate: donor?.lastDonationDate ?? null,
    };
  }

  // ══════════════════════════════════════════════════════
  //  CHANGE PASSWORD
  // ══════════════════════════════════════════════════════
  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await User.findById(userId).select("+passwordHash");
    if (!user) throw new ApiError(404, "User not found");

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) throw new ApiError(400, "Incorrect current password");

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.security.passwordChangedAt = new Date();
    await user.save();
  }

  // ══════════════════════════════════════════════════════
  //  DEACTIVATE ACCOUNT
  // ══════════════════════════════════════════════════════
  static async deactivateAccount(
    userId: string,
    sessionId: string,
    ip: string,
    userAgent: string,
  ) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    user.isActive = false;
    user.security.activeSessions = 0;
    await user.save();

    await Promise.all([
      Session.updateMany(
        { userId, isActive: true },
        { $set: { isActive: false, loggedOutAt: new Date() } },
      ),
      Donor.findOneAndUpdate(
        { userId },
        { $set: { isAvailable: false } },
      ),
    ]);

    await UserActivity.create({
      userId,
      sessionId,
      event: "profile_update",
      meta: { action: "deactivate_account" },
      ip: this.cleanIp(ip),
      userAgent,
      timestamp: new Date(),
    }).catch(() => {});
  }

  // ══════════════════════════════════════════════════════
  //  DELETE ACCOUNT PERMANENTLY
  // ══════════════════════════════════════════════════════
  static async deleteAccount(
    userId: string,
    sessionId: string,
    ip: string,
    userAgent: string,
    reason?: string,
  ) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    const donor = await Donor.findOne({ userId });

    await DeletedUser.create({
      userId: user._id,
      deletedBy: user._id,
      reason: reason?.trim() || "user_requested",
      userSnapshot: user.toObject(),
      donorSnapshot: donor ? donor.toObject() : null,
      meta: {
        ip: this.cleanIp(ip),
        userAgent,
      },
      deletedAt: new Date(),
    });

    user.isActive = false;
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.security.activeSessions = 0;
    await user.save();

    await Promise.all([
      Session.updateMany(
        { userId, isActive: true },
        { $set: { isActive: false, loggedOutAt: new Date() } },
      ),
      Donor.findOneAndUpdate(
        { userId },
        { $set: { isAvailable: false } },
      ),
    ]);

    await UserActivity.create({
      userId,
      sessionId,
      event: "account_delete",
      meta: { action: "soft_delete", reason: reason || "" },
      ip: this.cleanIp(ip),
      userAgent,
      timestamp: new Date(),
    }).catch(() => {});
  }
}
