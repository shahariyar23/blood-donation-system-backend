export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  errors?: string[];

  constructor(
    statusCode: number,
    message: string,
    errors?: string[],
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    Object.setPrototypeOf(this, ApiError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}