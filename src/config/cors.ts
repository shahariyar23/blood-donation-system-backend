import cors, { CorsOptions } from "cors";
import { ApiError }          from "../shared/utils/ApiError";

// ── Allowed origins ────────────────────────────────────
const allowedOrigins: string[] = [
  process.env.CLIENT_URL || "http://localhost:5173",

  // add more origins here if needed
  // "https://bloodconnect.vercel.app",
];

const corsOptions: CorsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // allow requests with no origin (Postman, mobile apps, curl)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new ApiError(403, `CORS: Origin "${origin}" is not allowed`));
    }
  },

  credentials:     true,   // allow cookies (refreshToken)
  methods:         ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders:  ["Content-Type", "Authorization"],
  exposedHeaders:  ["X-Total-Count"],  // useful for pagination headers
  maxAge:          86400,              // preflight cache: 24 hours
};

export default cors(corsOptions);