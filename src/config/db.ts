import mongoose from "mongoose";
import Session from "../modules/auth/Session.schema";

const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is not defined in .env file");
    }

    const conn = await mongoose.connect(uri, {
      dbName: "bloodconnect",
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    // Keep indexes aligned with schema and remove legacy ones.
    // This fixes old TTL indexes (e.g., tokenExpiresAt) that can delete
    // sessions after 15 minutes instead of refresh token expiry.
    await Session.syncIndexes();
    console.log("✅ Session indexes synchronized");

    // ── Connection events ──────────────────────────────
    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️  MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected successfully");
    });

    mongoose.connection.on("error", (err) => {
      console.error(`❌ MongoDB error: ${err.message}`);
    });

  } catch (error: any) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;