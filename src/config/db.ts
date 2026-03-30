import mongoose from "mongoose";

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