import { Request, Response } from "express";
import { AuthService }       from "./auth.service";
import { asyncHandler }      from "../../shared/utils/asyncHandler";
import { ApiResponse }       from "../../shared/utils/ApiResponse";
import { ApiError }          from "../../shared/utils/ApiError";
import User                  from "../user/User.schema";

// ── Cookie config ──────────────────────────────────────
const cookieOptions = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
};

// ══════════════════════════════════════════════════════
//  POST /api/auth/register
// ══════════════════════════════════════════════════════
export const register = asyncHandler(async (req: Request, res: Response) => {
  const ip        = (req.ip || "").replace("::ffff:", "");
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
  const ip        = (req.ip || "").replace("::ffff:", "");
  const userAgent = req.headers["user-agent"] || "";

  const result = await AuthService.login(req.body, ip, userAgent);

  res.cookie("refreshToken", result.refreshToken, cookieOptions);

  res
    .status(200)
    .json(new ApiResponse(200, "Logged in successfully", result.data));
});

// ══════════════════════════════════════════════════════
//  POST /api/auth/logout
// ══════════════════════════════════════════════════════
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const ip        = req.ip                    || "";
  const userAgent = req.headers["user-agent"] || "";

  await AuthService.logout(
    req.user!.id,
    req.user!.sessionId,
    ip,
    userAgent
  );

  res.clearCookie("refreshToken");

  res
    .status(200)
    .json(new ApiResponse(200, "Logged out successfully"));
});

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

    res
      .status(200)
      .json(new ApiResponse(200, "Token refreshed successfully", data));
  }
);

// ══════════════════════════════════════════════════════
//  POST /api/auth/forgot-password
// ══════════════════════════════════════════════════════
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email }   = req.body;
    const clientUrl   = process.env.CLIENT_URL || "";

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
    const ip        = req.ip                    || "";
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
//  GET /api/auth/me
// ══════════════════════════════════════════════════════
export const getAuthUser = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id).select(
      "name email phone avatar role bloodType isVerified isDonorVerified isAvailable location"
    );

    if (!user) {
      throw new ApiError(401, "Unauthorized");
    }

    res
      .status(200)
      .json(new ApiResponse(200, "Authenticated user", user));
  }
);