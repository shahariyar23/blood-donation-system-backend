import { Request, Response } from "express";
import { v2 as cloudinary }  from "cloudinary";
import fs                    from "fs/promises";
import { AuthService }       from "./auth.service";
import { asyncHandler }      from "../../shared/utils/asyncHandler";
import { ApiResponse }       from "../../shared/utils/ApiResponse";
import { ApiError }          from "../../shared/utils/ApiError";
import User                  from "../user/User.schema";
import { Donor, UserActivity } from "../index";

// ── Cookie config ──────────────────────────────────────
const isProd = process.env.NODE_ENV === "production";
const sameSite: "lax" | "none" = isProd ? "none" : "lax";
const cookieOptions = {
  httpOnly: true,
  secure:   isProd,
  // Strict blocks cross-site refresh; allow for separate frontend domain in prod
  sameSite,
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

// ── IP extractor ───────────────────────────────────────
// reads real client IP from x-forwarded-for header first,
// then falls back to req.ip and socket address
// replaces ::ffff: (IPv4-mapped IPv6) and ::1 (localhost IPv6)
const extractIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"] as string;

  const raw = forwarded
    ? forwarded.split(",")[0].trim()
    : req.ip || req.socket.remoteAddress || "";

  return raw
    .replace("::ffff:", "")  // IPv4-mapped IPv6 → plain IPv4
    .replace("::1", "127.0.0.1"); // localhost IPv6 → localhost IPv4
};

const logUserActivity = async (
  req: Request,
  userId: string,
  event: "profile_view" | "profile_update" | "avatar_upload",
  meta: Record<string, any> = {},
) => {
  await UserActivity.create({
    userId,
    sessionId: req.user?.sessionId,
    event,
    meta,
    ip: extractIp(req),
    userAgent: req.headers["user-agent"] || "",
    timestamp: new Date(),
  }).catch(() => {});
};

// ══════════════════════════════════════════════════════
//  POST /api/auth/upload-avatar
//  Upload avatar to Cloudinary (multer middleware required)
// ══════════════════════════════════════════════════════
export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  const file = (req as any).file as Express.Multer.File | undefined;

  if (!file) {
    throw new ApiError(400, "No avatar file uploaded");
  }

  const filePath = file.path;

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ApiError(500, "Cloudinary is not configured");
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const result = await cloudinary.uploader.upload(filePath, {
      folder: "bloodConnect/avatars",
      resource_type: "image",
    });

    res
      .status(201)
      .json(
        new ApiResponse(201, "Avatar uploaded successfully", {
          avatarUrl: result.secure_url,
        })
      );

    if (req.user?.id) {
      await logUserActivity(req, req.user.id, "avatar_upload", {
        action: "upload_avatar",
      });
    }
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
});

// ══════════════════════════════════════════════════════
//  POST /api/auth/register
// ══════════════════════════════════════════════════════
export const register = asyncHandler(async (req: Request, res: Response) => {
  const ip        = extractIp(req);
  const userAgent = req.headers["user-agent"] || "";

  const data = await AuthService.register(req.body, ip, userAgent);

  res
    .status(201)
    .json(new ApiResponse(201, "Account created successfully. Please log in.", data));
});

// ══════════════════════════════════════════════════════
//  POST /api/auth/login
// ══════════════════════════════════════════════════════
export const login = asyncHandler(async (req: Request, res: Response) => {
  const ip = extractIp(req);
  const userAgent = req.headers["user-agent"] || "";

  const result = await AuthService.login(req.body, ip, userAgent);

  // refreshToken → HTTP-only cookie (never exposed to JS)
  // accessToken  → response body (frontend stores in memory/redux)
  res.cookie("refreshToken", result.refreshToken, cookieOptions);

  res
    .status(200)
    .json(new ApiResponse(200, "Logged in successfully", result.data));
});

// ══════════════════════════════════════════════════════
//  POST /api/auth/logout
// ══════════════════════════════════════════════════════
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const ip        = extractIp(req);
  const userAgent = req.headers["user-agent"] || "";

  await AuthService.logout(
    req.user!.id,
    req.user!.sessionId,
    ip,
    userAgent
  );

  res.clearCookie("refreshToken", cookieOptions);

  res
    .status(200)
    .json(new ApiResponse(200, "Logged out successfully"));
});

// ══════════════════════════════════════════════════════
//  GET /api/auth/sessions
// ══════════════════════════════════════════════════════
export const getMySessions = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await AuthService.getMySessions(
      req.user!.id,
      req.user!.sessionId,
    );

    await logUserActivity(req, req.user!.id, "profile_view", {
      action: "view_sessions",
      totalSessions: data.totalSessions,
    });

    res
      .status(200)
      .json(new ApiResponse(200, "Active sessions fetched successfully", data));
  }
);

// ══════════════════════════════════════════════════════
//  POST /api/auth/sessions/logout-others
// ══════════════════════════════════════════════════════
export const logoutOtherSessions = asyncHandler(
  async (req: Request, res: Response) => {
    const ip        = extractIp(req);
    const userAgent = req.headers["user-agent"] || "";

    const data = await AuthService.logoutOtherSessions(
      req.user!.id,
      req.user!.sessionId,
      ip,
      userAgent,
    );

    res
      .status(200)
      .json(new ApiResponse(200, "All other sessions logged out successfully", data));
  }
);

// ══════════════════════════════════════════════════════
//  DELETE /api/auth/sessions/:sessionId
// ══════════════════════════════════════════════════════
export const logoutSingleSession = asyncHandler(
  async (req: Request, res: Response) => {
    const ip        = extractIp(req);
    const userAgent = req.headers["user-agent"] || "";

    const data = await AuthService.logoutSession(
      req.user!.id,
      req.params.sessionId,
      req.user!.sessionId,
      ip,
      userAgent,
    );

    res
      .status(200)
      .json(new ApiResponse(200, "Session logged out successfully", data));
  }
);

// ══════════════════════════════════════════════════════
//  POST /api/auth/deactivate-account
// ══════════════════════════════════════════════════════
export const deactivateAccount = asyncHandler(
  async (req: Request, res: Response) => {
    const ip        = extractIp(req);
    const userAgent = req.headers["user-agent"] || "";

    await AuthService.deactivateAccount(
      req.user!.id,
      req.user!.sessionId,
      ip,
      userAgent,
    );

    res.clearCookie("refreshToken", cookieOptions);

    res
      .status(200)
      .json(new ApiResponse(200, "Account deactivated successfully"));
  }
);

// ══════════════════════════════════════════════════════
//  DELETE /api/auth/delete-account
// ══════════════════════════════════════════════════════
export const deleteAccount = asyncHandler(
  async (req: Request, res: Response) => {
    const ip        = extractIp(req);
    const userAgent = req.headers["user-agent"] || "";
    const reason = (req.body?.reason as string) || "";

    await AuthService.deleteAccount(
      req.user!.id,
      req.user!.sessionId,
      ip,
      userAgent,
      reason,
    );

    res.clearCookie("refreshToken", cookieOptions);

    res
      .status(200)
      .json(new ApiResponse(200, "Account deleted successfully"));
  }
);

// ══════════════════════════════════════════════════════
//  POST /api/auth/refresh-token
// ══════════════════════════════════════════════════════
export const refreshAccessToken = asyncHandler(
  async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken;

    if (!token) {
      throw new ApiError(401, "No refresh token provided");
    }

    const data = await AuthService.refreshAccessToken(token);

    // Set new refresh token cookie just in case, to refresh the expiration
    res.cookie("refreshToken", data.refreshToken, cookieOptions);

    res
      .status(200)
      .json(
        new ApiResponse(200, "Token refreshed successfully", {
          accessToken: data.accessToken,
          role: data.role,
        }),
      );
  }
);

// ══════════════════════════════════════════════════════
//  POST /api/auth/forgot-password
// ══════════════════════════════════════════════════════
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    const clientUrl = process.env.CLIENT_URL || "";

    await AuthService.forgotPassword(email, clientUrl);

    // always same message — never reveal if email exists
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "If this email is registered, a reset link has been sent"
        )
      );
  }
);

// ══════════════════════════════════════════════════════
//  POST /api/auth/reset-password
// ══════════════════════════════════════════════════════
export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;
    const ip        = extractIp(req);
    const userAgent = req.headers["user-agent"] || "";

    await AuthService.resetPassword(token, newPassword, ip, userAgent);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Password reset successfully. Please log in again."
        )
      );
  }
);

// ══════════════════════════════════════════════════════
//  POST /api/auth/send-otp
// ══════════════════════════════════════════════════════
export const sendEmailOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    const ip        = extractIp(req);
    const userAgent = req.headers["user-agent"] || "";

    const data = await AuthService.sendEmailVerificationOtp(email, ip, userAgent);

    res
      .status(200)
      .json(new ApiResponse(200, "OTP sent successfully", data));
  }
);

// ══════════════════════════════════════════════════════
//  POST /api/auth/verify-otp
// ══════════════════════════════════════════════════════
export const verifyEmailOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const ip        = extractIp(req);
    const userAgent = req.headers["user-agent"] || "";

    const data = await AuthService.verifyEmailOtp(email, otp, ip, userAgent);

    res
      .status(200)
      .json(new ApiResponse(200, "Email verified successfully", data));
  }
);

// ══════════════════════════════════════════════════════
//  GET /api/auth/me
// ══════════════════════════════════════════════════════
export const getAuthUser = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id).select(
      "name email phone avatar role bloodType isVerified location age weight gender dateOfBirth socialLinks lastReceivedDate totalReceived createdAt updatedAt",
    );

    if (!user) {
      throw new ApiError(401, "Unauthorized");
    }
    const donor =
      user.role === "donor"
        ? await Donor.findOne({ userId: user._id }).select(
            "isAvailable totalDonations lastDonationDate isVerified",
          )
        : null;

    const payload = {
      ...user.toObject(),
      isAvailable: donor?.isAvailable ?? false,
      isDonorVerified: donor?.isVerified ?? false,
      totalDonations: donor?.totalDonations ?? 0,
      lastDonationDate: donor?.lastDonationDate ?? null,
    };

    await logUserActivity(req, req.user!.id, "profile_view", {
      action: "get_auth_user",
    });

    res
      .status(200)
      .json(new ApiResponse(200, "Authenticated user", payload));
  }
);

// ══════════════════════════════════════════════════════
//  PUT /api/auth/me
// ══════════════════════════════════════════════════════
export const updateAuthUser = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await AuthService.updateAuthUser(req.user!.id, req.body);

    await logUserActivity(req, req.user!.id, "profile_update", {
      action: "update_auth_user",
      fields: Object.keys(req.body || {}),
    });

    res
      .status(200)
      .json(new ApiResponse(200, "User updated successfully", data));
  }
);

// ══════════════════════════════════════════════════════
//  POST /api/auth/change-password
// ══════════════════════════════════════════════════════
export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    await AuthService.changePassword(req.user!.id, currentPassword, newPassword);

    await logUserActivity(req, req.user!.id, "profile_update", {
      action: "change_password",
    });

    res
      .status(200)
      .json(new ApiResponse(200, "Password changed successfully"));
  }
);
