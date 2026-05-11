import app from "./app";
import dotenv from "dotenv";
import connectDB from "./config/db";
import { startBloodRequestExpiryJob } from "./jobs/bloodRequestExpiry.job";

dotenv.config();
connectDB();
startBloodRequestExpiryJob();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});