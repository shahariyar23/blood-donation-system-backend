import jwt from "jsonwebtoken";

const ACCESS_SECRET  = process.env.JWT_SECRET         || "access_secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh_secret";

export const generateAccessToken = (userId: string, role: string): string => {
  return jwt.sign({ id: userId, role }, ACCESS_SECRET, {
    expiresIn: "15m",
  });
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ id: userId }, REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, ACCESS_SECRET);
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, REFRESH_SECRET);
};
