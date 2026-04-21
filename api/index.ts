import app from "../src/app";
import connectDB from "../src/config/db";

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
  return app(req, res);
}