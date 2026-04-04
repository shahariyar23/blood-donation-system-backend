import { Request, Response, NextFunction } from "express";
import { ApiError } from "../shared/utils";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("ERROR:", err);

  // If it's our custom error
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors || [],
    });
  }

  // Unknown error
  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
};