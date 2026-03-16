import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ message: "BloodConnect API is running" });
});

// ── Health route ───────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    status:    "ok",
    message:   "BloodConnect API is healthy",
    timestamp: new Date().toISOString(),
    uptime:    `${Math.floor(process.uptime())}s`,
  });
});

export default app;