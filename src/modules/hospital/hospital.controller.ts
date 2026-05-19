import { Request, Response } from "express";
import { HospitalAuthService } from "./hospital.service";
import { ApiResponse, asyncHandler, ApiError } from "../../shared/utils";

// ── IP extractor ───────────────────────────────────────
const extractIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"] as string;

  const raw = forwarded
    ? forwarded.split(",")[0].trim()
    : req.ip || req.socket.remoteAddress || "";

  return raw
    .replace("::ffff:", "") // IPv4-mapped IPv6 → plain IPv4
    .replace("::1", "127.0.0.1"); // localhost IPv6 → localhost IPv4
};

// ══════════════════════════════════════════════════════
//  POST /api/v1/hospital/auth/register
//  Register Hospital (Admin Only)
// ══════════════════════════════════════════════════════
export const registerHospital = asyncHandler(
  async (req: Request, res: Response) => {
    // Verify admin role
    if (req.user?.role !== "admin") {
      throw new ApiError(403, "Only admins can register hospitals");
    }

    const result = await HospitalAuthService.registerHospital(req.body, req.user.id);

    res.status(201).json(
      new ApiResponse(
        201,
        result.message,
        result
      ),
    );
  },
);

// ══════════════════════════════════════════════════════
//  POST /api/v1/hospital/auth/login
//  Hospital Login
// ══════════════════════════════════════════════════════
export const hospitalLogin = asyncHandler(
  async (req: Request, res: Response) => {
    const ipAddress = extractIp(req);
    const userAgent = req.headers["user-agent"] || "";

    const result = await HospitalAuthService.login(req.body, ipAddress, userAgent);

    // Set refresh token in httpOnly cookie
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    res.status(200).json(
      new ApiResponse(
        200,
        result.message,
        {
          hospital: result.hospital,
          accessToken: result.accessToken,
        }
      ),
    );
  },
);

// ══════════════════════════════════════════════════════
//  POST /api/v1/hospital/auth/refresh-token
//  Refresh Access Token using refresh token cookie
// ══════════════════════════════════════════════════════
export const refreshHospitalAccessToken = asyncHandler(
  async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken;
    const result = await HospitalAuthService.refreshAccessToken(refreshToken);

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.status(200).json(
      new ApiResponse(
        200,
        result.message,
        {
          accessToken: result.accessToken,
        }
      ),
    );
  },
);

// ══════════════════════════════════════════════════════
//  POST /api/v1/hospital/auth/logout
//  Logout Hospital
// ══════════════════════════════════════════════════════
export const hospitalLogout = asyncHandler(
  async (req: Request, res: Response) => {
    if (req.user?.role !== "hospital") {
      throw new ApiError(403, "Only hospitals can logout from this endpoint");
    }

    const ipAddress = extractIp(req);
    const userAgent = req.headers["user-agent"] || "";

    const result = await HospitalAuthService.logout(req.user.id, ipAddress, userAgent);

    const isProd = process.env.NODE_ENV === "production";
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
    });

    res.status(200).json(new ApiResponse(200, result.message, {}));
  },
);

// ══════════════════════════════════════════════════════
//  POST /api/v1/hospital/auth/forgot-password
//  Request Password Reset
// ══════════════════════════════════════════════════════
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await HospitalAuthService.forgotPassword(req.body);

    res.status(200).json(
      new ApiResponse(
        200,
        result.message,
        {}
      ),
    );
  },
);

// ══════════════════════════════════════════════════════
//  POST /api/v1/hospital/auth/reset-password
//  Reset Password (Requires Admin Permission)
// ══════════════════════════════════════════════════════
export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await HospitalAuthService.resetPassword(req.body);

    res.status(200).json(
      new ApiResponse(
        200,
        result.message,
        {}
      ),
    );
  },
);

// ══════════════════════════════════════════════════════
//  POST /api/v1/hospital/auth/change-password
//  Change Password (Authenticated Hospital Only)
// ══════════════════════════════════════════════════════
export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    // Verify hospital is authenticated
    if (req.user?.role !== "hospital") {
      throw new ApiError(403, "Only hospitals can change their password");
    }

    const ipAddress = extractIp(req);
    const userAgent = req.headers["user-agent"] || "";

    const result = await HospitalAuthService.changePassword(
      req.user.id,
      req.body,
      ipAddress,
      userAgent,
    );

    res.status(200).json(
      new ApiResponse(
        200,
        result.message,
        {}
      ),
    );
  },
);
