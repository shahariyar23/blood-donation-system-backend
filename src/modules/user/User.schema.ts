import mongoose, { Schema, Document } from "mongoose";

// ── Types ──────────────────────────────────────────────
export interface IUser extends Document {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  age: number;
  gender: "male" | "female";
  avatar: string;
  bloodType: string;
  weight: number;
  lastDonationDate: Date | null;
  totalDonations: number;
  isAvailable: boolean;
  location: {
    city: String;
    country: String;
    country_code: String;
    county: String;
    postcode: String;
    state: String;
    state_district: String;
    coordinates: { lat: number; lng: number };
  };
  socialLinks: {
    facebook: string | null;
    instagram: string | null;
    twitter: string | null;
  };
  role: "donor" | "recipient" | "admin";
  isVerified: boolean;
  isDonorVerified: boolean;
  isActive: boolean;
  communityFlags: number;
  security: {
    loginAttempts: number;
    lockedUntil: Date | null;
    lastLoginAt: Date | null;
    lastLoginIp: string | null;
    lastLoginDevice: string | null;
    twoFactorEnabled: boolean;
    twoFactorSecret: string | null;
    passwordChangedAt: Date | null;
    activeSessions: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ─────────────────────────────────────────────
const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned in queries by default
    },
    age: {
      type: Number,
      min: [18, "Must be at least 18"],
      max: [65, "Must be under 65"],
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    avatar: {
      type: String,
      default: "",
    },
    bloodType: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
    },
    weight: {
      type: Number,
      min: [50, "Minimum weight is 50 kg"],
    },
    lastDonationDate: {
      type: Date,
      default: null,
    },
    totalDonations: {
      type: Number,
      default: 0,
      min: 0,
    },
    isAvailable: {
      type: Boolean,
      default: false,
    },
    location: {
      city: { type: String, default: "" },
      country: { type: String, default: "" },
      country_code: { type: String, default: "" },
      county: { type: String, default: "" },
      postcode: { type: String, default: "" },
      state: { type: String, default: "" },
      state_district: { type: String, default: "" },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },
    socialLinks: {
      facebook: { type: String, default: null },
      instagram: { type: String, default: null },
      twitter: { type: String, default: null },
    },
    role: {
      type: String,
      enum: ["donor", "recipient", "admin"],
      default: "recipient",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isDonorVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    communityFlags: {
      type: Number,
      default: 0,
      min: 0,
    },
    security: {
      loginAttempts: { type: Number, default: 0 },
      lockedUntil: { type: Date, default: null },
      lastLoginAt: { type: Date, default: null },
      lastLoginIp: { type: String, default: null },
      lastLoginDevice: { type: String, default: null },
      twoFactorEnabled: { type: Boolean, default: false },
      twoFactorSecret: { type: String, default: null, select: false },
      passwordChangedAt: { type: Date, default: null },
      activeSessions: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true, // auto createdAt + updatedAt
    versionKey: false,
  },
);

// ── Indexes ────────────────────────────────────────────
UserSchema.index({ bloodType: 1 });
UserSchema.index({ "location.district": 1 });
UserSchema.index({ isAvailable: 1, isDonorVerified: 1 });
UserSchema.index({ role: 1, isActive: 1 });

export default mongoose.model<IUser>("User", UserSchema);
