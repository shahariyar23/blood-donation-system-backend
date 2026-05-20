import cors, { CorsOptions } from "cors";
import { ApiError } from "../shared/utils/ApiError";
import env from "./env";

// ── Allowed origins ────────────────────────────────────
const rawOrigins =
  env.CLIENT_URL ||
  "http://localhost:5173,http://localhost:3000,https://blood-donation-system-ui.vercel.app";

const allowedOrigins: string[] = rawOrigins
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

console.log(rawOrigins);

const corsOptions: CorsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
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

  credentials: true, // allow cookies (refreshToken)
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Total-Count"], // useful for pagination headers
  maxAge: 86400, // preflight cache: 24 hours
};

export default cors(corsOptions);
