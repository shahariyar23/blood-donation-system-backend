import express from "express";
import corsMiddleware from "./config/cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import router from "./routes";
import { errorHandler } from "./middleware";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(corsMiddleware);
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1",router)
app.use(errorHandler);


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