import { Request, Response, NextFunction } from "express";
import { ApiError } from "../shared/utils";

// ══════════════════════════════════════════════════════
//  authorize(...roles)
//  Use AFTER protect — checks if user has the required role
//
//  Usage:
//    router.delete("/users/:id", protect, authorize("admin"), deleteUser)
//    router.patch("/availability", protect, authorize("donor"), toggleAvailability)
// ══════════════════════════════════════════════════════
export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(
        403,
        `Access denied. Required role: [${roles.join(", ")}]. Your role: ${req.user.role}`
      );
    }

    next();
  };
};