import app from "../src/app";
import connectDB from "../src/config/db";
import { startBloodRequestExpiryJob } from "../src/jobs/bloodRequestExpiry.job";

let hasConnected = false;

const ensureConnection = async () => {
  if (hasConnected) {
    return;
  }

  await connectDB();
  hasConnected = true;
};

export default async function handler(req: any, res: any) {
  await ensureConnection();
  startBloodRequestExpiryJob();
  return app(req, res);
}