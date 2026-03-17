import { Request, Response, NextFunction } from "express";
import { ApiError } from "../shared/utils";

// ══════════════════════════════════════════════════════
//  errorHandler
//  Global error handler — must be registered LAST in app.ts
//  Catches all errors thrown anywhere in the app
// ══════════════════════════════════════════════════════
export const errorHandler = (
  err:  Error | ApiError,
  req:  Request,
  res:  Response,
  _next: NextFunction
): void => {

  // ── Default values ─────────────────────────────────
  let statusCode = 500;
  let message    = "Internal server error";
  let errors: string[] | undefined;

  // ── Known ApiError ─────────────────────────────────
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message    = err.message;
    errors     = err.errors;
  }

  // ── Mongoose validation error ──────────────────────
  else if (err.name === "ValidationError") {
    statusCode = 400;
    message    = "Validation failed";
    errors     = Object.values((err as any).errors).map(
      (e: any) => e.message
    );
  }

  // ── Mongoose duplicate key error ───────────────────
  else if ((err as any).code === 11000) {
    statusCode = 409;
    const field = Object.keys((err as any).keyValue || {})[0];
    message    = `${field} is already taken`;
  }

  // ── Mongoose invalid ObjectId ──────────────────────
  else if (err.name === "CastError") {
    statusCode = 400;
    message    = `Invalid ${(err as any).path}: ${(err as any).value}`;
  }

  // ── JWT errors ─────────────────────────────────────
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message    = "Invalid token";
  }

  else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message    = "Token expired";
  }

  // ── Log in development ─────────────────────────────
  if (process.env.NODE_ENV === "development") {
    console.error(`[ERROR] ${err.stack}`);
  }

  res.status(statusCode).json({
    success:    false,
    statusCode,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

// ══════════════════════════════════════════════════════
//  notFound
//  Catches requests to undefined routes
//  Register BEFORE errorHandler in app.ts
// ══════════════════════════════════════════════════════
export const notFound = (
  req:  Request,
  _res: Response,
  next: NextFunction
): void => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};