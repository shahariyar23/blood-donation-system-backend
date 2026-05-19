import bcrypt from "bcrypt";
import crypto from "crypto";
import UAParser from "ua-parser-js";
import geoip from "geoip-lite";
import Hospital from "./Hospital.schema";
import User from "../user/User.schema";
import {
  ApiError,
  generateAccessToken,
  generateRefreshToken,
  sendEmail,
  verifyRefreshToken,
} from "../../shared/utils";
import {
  RegisterHospitalRequest,
  HospitalLoginRequest,
  HospitalForgotPasswordRequest,
  HospitalResetPasswordRequest,
  ChangePasswordRequest,
} from "./hospital.validation";
import {
  hospitalPasswordChangedTemplate,
  hospitalPasswordResetRequestTemplate,
  hospitalPasswordResetSuccessTemplate,
  hospitalRegistrationTemplate,
} from "../../utils/email.payloads";

export class HospitalAuthService {
  // ══════════════════════════════════════════════════════
  //  REGISTER HOSPITAL (Admin Only)
  // ══════════════════════════════════════════════════════
  static async registerHospital(data: RegisterHospitalRequest, adminId: string) {
    // Verify admin exists and is admin role
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== "admin") {
      throw new ApiError(403, "Only admins can register hospitals");
    }

    // Check if hospital email already exists
    const existingEmail = await Hospital.findOne({ email: data.email.toLowerCase() });
    if (existingEmail) {
      throw new ApiError(409, "Hospital with this email already exists");
    }

    // Check if registration number already exists
    const existingRegistration = await Hospital.findOne({
      registrationNumber: data.registrationNumber,
    });
    if (existingRegistration) {
      throw new ApiError(409, "Hospital with this registration number already exists");
    }

    // Check if license number already exists
    const existingLicense = await Hospital.findOne({
      licenseNumber: data.licenseNumber,
    });
    if (existingLicense) {
      throw new ApiError(409, "Hospital with this license number already exists");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create hospital record
    const hospital = await Hospital.create({
      hospitalName: data.hospitalName,
      registrationNumber: data.registrationNumber,
      email: data.email.toLowerCase(),
      passwordHash,
      phone: data.phone,
      licenseNumber: data.licenseNumber,
      address: data.address,
      website: data.website,
      adminName: data.adminName,
      adminEmail: data.adminEmail,
      adminPhone: data.adminPhone,
      totalBedCapacity: data.totalBedCapacity,
      bloodBankCapacity: data.bloodBankCapacity,
      isVerified: false,
      isActive: true,
      location: {
        area: data.location.area,
        district: data.location.district,
        division: data.location.division,
        coordinates: {
          type: "Point",
          coordinates: [data.location.coordinates.lng, data.location.coordinates.lat],
        },
      },
    });

    // Add audit log
    hospital.auditLogs.push({
      action: "hospital_created",
      performedBy: new (require("mongoose").Types.ObjectId)(adminId),
      performedAt: new Date(),
      notes: `Hospital registered by admin: ${admin.name}`,
    });

    await hospital.save();

    // Send welcome email to hospital
    await sendEmail({
      to: data.email,
      subject: "Hospital Registration Successful",
      html: hospitalRegistrationTemplate({
        hospitalName: data.hospitalName,
        email: data.email,
        password: data.password,
      }),
    }).catch(() => {});

    return {
      message: "Hospital registered successfully",
      hospital: {
        id: hospital._id,
        hospitalName: hospital.hospitalName,
        email: hospital.email,
        phone: hospital.phone,
        isVerified: hospital.isVerified,
        isActive: hospital.isActive,
      },
    };
  }

  // ══════════════════════════════════════════════════════
  //  LOGIN
  // ══════════════════════════════════════════════════════
  static async login(data: HospitalLoginRequest, ipAddress: string, userAgent: string) {
    const hospital = await Hospital.findOne({ email: data.email.toLowerCase() });

    if (!hospital) {
      throw new ApiError(401, "Invalid email or password");
    }

    if (!hospital.isActive) {
      throw new ApiError(403, "Hospital account is inactive");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(data.password, hospital.passwordHash);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid email or password");
    }

    // Parse device info
    const locationInfo = this.getIpLocation(ipAddress);

    // Generate tokens
    const accessToken = generateAccessToken(String(hospital._id), "hospital");
    const refreshToken = generateRefreshToken(String(hospital._id));

    // Persist hashed refresh token for server-side revocation control
    hospital.refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");
    hospital.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Add audit log
    hospital.auditLogs.push({
      action: "hospital_login",
      performedBy: hospital._id,
      performedAt: new Date(),
      ipAddress: ipAddress || "",
      userAgent: userAgent || "",
      notes: `Hospital login from ${locationInfo.city || "unknown location"}`,
    });

    await hospital.save();

    return {
      message: "Login successful",
      hospital: {
        id: hospital._id,
        hospitalName: hospital.hospitalName,
        email: hospital.email,
        phone: hospital.phone,
        isVerified: hospital.isVerified,
      },
      accessToken,
      refreshToken,
    };
  }

  // ══════════════════════════════════════════════════════
  //  REFRESH ACCESS TOKEN
  // ══════════════════════════════════════════════════════
  static async refreshAccessToken(refreshToken: string) {
    if (!refreshToken) {
      throw new ApiError(401, "Refresh token is required");
    }

    let decoded: any;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    const hospital = await Hospital.findById(decoded.id);
    if (!hospital) {
      throw new ApiError(401, "Hospital not found");
    }

    if (!hospital.isActive) {
      throw new ApiError(403, "Hospital account is inactive");
    }

    const incomingHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    if (!hospital.refreshTokenHash || hospital.refreshTokenHash !== incomingHash) {
      throw new ApiError(401, "Refresh token is invalid or revoked");
    }

    if (!hospital.refreshTokenExpiresAt || new Date() > hospital.refreshTokenExpiresAt) {
      throw new ApiError(401, "Refresh token expired. Please log in again.");
    }

    const accessToken = generateAccessToken(String(hospital._id), "hospital");
    const newRefreshToken = generateRefreshToken(String(hospital._id));

    // Rotate refresh token on every refresh
    hospital.refreshTokenHash = crypto
      .createHash("sha256")
      .update(newRefreshToken)
      .digest("hex");
    hospital.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await hospital.save();

    return {
      message: "Access token refreshed successfully",
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  // ══════════════════════════════════════════════════════
  //  LOGOUT
  // ══════════════════════════════════════════════════════
  static async logout(hospitalId: string, ipAddress: string, userAgent: string) {
    const hospital = await Hospital.findById(hospitalId);

    if (!hospital) {
      throw new ApiError(404, "Hospital not found");
    }

    // Revoke refresh token server-side
    hospital.refreshTokenHash = null;
    hospital.refreshTokenExpiresAt = null;

    hospital.auditLogs.push({
      action: "hospital_updated",
      performedBy: hospital._id,
      performedAt: new Date(),
      ipAddress: ipAddress || "",
      userAgent: userAgent || "",
      notes: "Hospital logged out",
    });

    await hospital.save();

    return { message: "Logged out successfully" };
  }

  // ══════════════════════════════════════════════════════
  //  FORGOT PASSWORD
  // ══════════════════════════════════════════════════════
  static async forgotPassword(data: HospitalForgotPasswordRequest) {
    const hospital = await Hospital.findOne({ email: data.email.toLowerCase() });

    if (!hospital) {
      // Don't reveal if email exists or not (security best practice)
      return {
        message:
          "If hospital email exists in our system, reset instructions will be sent",
      };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reset token hash in hospital document (if schema supports it)
    // For now, we'll use a temporary storage approach
    (hospital as any).passwordResetToken = resetTokenHash;
    (hospital as any).passwordResetExpires = resetTokenExpiry;

    // Add audit log
    hospital.auditLogs.push({
      action: "hospital_updated",
      performedBy: hospital._id,
      performedAt: new Date(),
      notes: "Password reset requested",
    });

    await hospital.save();

    // Send email with reset link
    const resetLink = `${process.env.CLIENT_URL}/hospital/reset-password?token=${resetToken}&email=${data.email}`;

    await sendEmail({
      to: data.email,
      subject: "Password Reset Instructions",
      html: hospitalPasswordResetRequestTemplate({ resetLink }),
    }).catch(() => {});

    return {
      message:
        "If hospital email exists in our system, reset instructions will be sent",
    };
  }

  // ══════════════════════════════════════════════════════
  //  RESET PASSWORD
  // ══════════════════════════════════════════════════════
  static async resetPassword(data: HospitalResetPasswordRequest) {
    const hospital = await Hospital.findOne({ email: data.email.toLowerCase() });

    if (!hospital) {
      throw new ApiError(404, "Hospital not found");
    }

    // Verify reset token
    const resetTokenHash = crypto.createHash("sha256").update(data.resetToken).digest("hex");
    const storedToken = (hospital as any).passwordResetToken;
    const tokenExpiry = (hospital as any).passwordResetExpires;

    if (!storedToken || storedToken !== resetTokenHash) {
      throw new ApiError(400, "Invalid or expired reset token");
    }

    if (!tokenExpiry || new Date() > tokenExpiry) {
      throw new ApiError(400, "Reset token has expired");
    }

    // Update password
    const newPasswordHash = await bcrypt.hash(data.newPassword, 10);
    hospital.passwordHash = newPasswordHash;

    // Clear reset token
    (hospital as any).passwordResetToken = null;
    (hospital as any).passwordResetExpires = null;

    // Add audit log
    hospital.auditLogs.push({
      action: "hospital_updated",
      performedBy: hospital._id,
      performedAt: new Date(),
      notes: "Password changed via reset token",
    });

    await hospital.save();

    // Send confirmation email
    await sendEmail({
      to: data.email,
      subject: "Password Reset Successful",
      html: hospitalPasswordResetSuccessTemplate(),
    }).catch(() => {});

    return {
      message: "Password reset successfully",
    };
  }

  // ══════════════════════════════════════════════════════
  //  CHANGE PASSWORD (Authenticated Hospital)
  // ══════════════════════════════════════════════════════
  static async changePassword(
    hospitalId: string,
    data: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    },
    ipAddress: string,
    userAgent: string,
  ) {
    const hospital = await Hospital.findById(hospitalId);

    if (!hospital) {
      throw new ApiError(404, "Hospital not found");
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(data.currentPassword, hospital.passwordHash);
    if (!isPasswordValid) {
      throw new ApiError(401, "Current password is incorrect");
    }

    // Update password
    const newPasswordHash = await bcrypt.hash(data.newPassword, 10);
    hospital.passwordHash = newPasswordHash;

    // Add audit log
    hospital.auditLogs.push({
      action: "hospital_updated",
      performedBy: hospital._id,
      performedAt: new Date(),
      ipAddress: ipAddress || "",
      userAgent: userAgent || "",
      notes: "Password changed by hospital",
    });

    await hospital.save();

    // Send confirmation email
    await sendEmail({
      to: hospital.email,
      subject: "Password Change Confirmation",
      html: hospitalPasswordChangedTemplate({
        hospitalName: hospital.hospitalName,
        ipAddress,
      }),
    }).catch(() => {});

    return {
      message: "Password changed successfully",
    };
  }

  // ══════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ══════════════════════════════════════════════════════

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
}
