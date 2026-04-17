import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../shared/utils";
import { ApiError } from "../shared/utils";
import { asyncHandler } from "../shared/utils";
import Session from "../modules/auth/Session.schema";
import User from "../modules/user/User.schema";

// ── Extend Express Request type ────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        sessionId: string;
      };
    }
  }
}

// ══════════════════════════════════════════════════════
//  protect
//  Verifies JWT access token — attach user to req.user
// ══════════════════════════════════════════════════════
export const protect = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    // ── Get token from Authorization header ───────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "Access token is required");
    }

    const token = authHeader.split(" ")[1];

    // ── Verify token ───────────────────────────────────
    let decoded: any;
    try {
      decoded = verifyAccessToken(token);
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        throw new ApiError(401, "Access token expired. Please refresh.");
      }
      throw new ApiError(401, "Invalid access token");
    }

    // ── Check session is still active ─────────────────
    const session = await Session.findOne({
      userId: decoded.id,
      token,
      isActive: true,
    }).select("_id");

    if (!session) {
      throw new ApiError(401, "Session expired. Please log in again.");
    }

    // ── Check user still exists and is active ─────────
    const user = await User.findById(decoded.id).select("role isActive");

    if (!user) {
      throw new ApiError(401, "User no longer exists");
    }

    if (!user.isActive) {
      throw new ApiError(403, "Your account has been deactivated");
    }

    // ── Attach to request ──────────────────────────────
    req.user = {
      id: decoded.id,
      role: user.role,
      sessionId: String(session._id),
    };

    next();
  },
);

// ══════════════════════════════════════════════════════
//  optionalProtect
//  Attaches user if token exists — does NOT block if missing
//  Use for public routes that behave differently when logged in
// ══════════════════════════════════════════════════════
export const optionalProtect = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(); // no token → continue as guest
    }

    try {
      const token = authHeader.split(" ")[1];
      const decoded: any = verifyAccessToken(token);

      const user = await User.findById(decoded.id).select("role isActive");

      if (user && user.isActive) {
        const session = await Session.findOne({
          userId: decoded.id,
          token,
          isActive: true,
        }).select("_id");

        if (session) {
          req.user = {
            id: decoded.id,
            role: user.role,
            sessionId: String(session._id),
          };
        }
      }
    } catch {
      // invalid token → continue as guest, don't throw
    }

    next();
  },
);
