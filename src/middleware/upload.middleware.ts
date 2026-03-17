import multer, { FileFilterCallback } from "multer";
import path                           from "path";
import fs                             from "fs";
import { Request }                    from "express";
import { ApiError }                   from "../shared/utils";

// ── Ensure uploads folder exists ───────────────────────
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ══════════════════════════════════════════════════════
//  Storage — saves file to /uploads with a unique name
// ══════════════════════════════════════════════════════
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext    = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

// ══════════════════════════════════════════════════════
//  File filter — images only
// ══════════════════════════════════════════════════════
const imageFilter = (
  _req:  Request,
  file:  Express.Multer.File,
  cb:    FileFilterCallback
): void => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, "Only JPEG, PNG and WebP images are allowed") as any);
  }
};

// ══════════════════════════════════════════════════════
//  upload.avatar  — single image, max 2MB
//  Usage: router.put("/avatar", protect, upload.avatar, updateAvatar)
// ══════════════════════════════════════════════════════
export const upload = {
  avatar: multer({
    storage,
    fileFilter: imageFilter,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  }).single("avatar"),
};