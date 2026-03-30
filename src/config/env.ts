import dotenv from "dotenv";

dotenv.config();

// ── Validate required env variables at startup ─────────
// App will crash immediately with a clear message
// instead of failing silently later
const requiredEnvVars = [
  "MONGODB_URI",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "CLIENT_URL",
] as const;

const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
  console.error(
    `❌ Missing required environment variables:\n   ${missingVars.join("\n   ")}`
  );
  process.exit(1);
}

// ── Typed env object ───────────────────────────────────
// Import this instead of process.env anywhere in the app
// so you get autocomplete + type safety
const env = {
  // server
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT:     process.env.PORT     || "5000",

  // database
  MONGODB_URI: process.env.MONGODB_URI!,

  // client
  CLIENT_URL: process.env.CLIENT_URL!,

  // JWT
  JWT_SECRET:          process.env.JWT_SECRET!,
  JWT_REFRESH_SECRET:  process.env.JWT_REFRESH_SECRET!,
  JWT_EXPIRES_IN:      process.env.JWT_EXPIRES_IN      || "15m",
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || "7d",

  // email
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",

  // helpers
  isDev:  process.env.NODE_ENV !== "production",
  isProd: process.env.NODE_ENV === "production",
} as const;

export default env;