import mongoose, { Schema, Document } from "mongoose";

export interface IBloodBank extends Document {
  name:    string;
  address: string;
  location: {
    area:        string;
    district:    string;
    division:    string;
    coordinates: { lat: number; lng: number };
  };
  phone:      string;
  email:      string;
  website:    string | null;
  hours:      string;
  isOpen:     boolean;
  rating:     number;
  totalUnits: number;
  availability: {
    "A+":  "high" | "medium" | "low" | "unavailable";
    "A-":  "high" | "medium" | "low" | "unavailable";
    "B+":  "high" | "medium" | "low" | "unavailable";
    "B-":  "high" | "medium" | "low" | "unavailable";
    "O+":  "high" | "medium" | "low" | "unavailable";
    "O-":  "high" | "medium" | "low" | "unavailable";
    "AB+": "high" | "medium" | "low" | "unavailable";
    "AB-": "high" | "medium" | "low" | "unavailable";
  };
  isVerified: boolean;
  isActive:   boolean;
  createdAt:  Date;
  updatedAt:  Date;
}

const availabilityEnum = ["high", "medium", "low", "unavailable"];

const BloodBankSchema = new Schema<IBloodBank>(
  {
    name: {
      type:     String,
      required: [true, "Bank name is required"],
      trim:     true,
    },
    address: {
      type:     String,
      required: [true, "Address is required"],
      trim:     true,
    },
    location: {
      area:     { type: String, default: "" },
      district: { type: String, default: "" },
      division: { type: String, default: "" },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },
    phone: {
      type:     String,
      required: [true, "Phone is required"],
      trim:     true,
    },
    email: {
      type:  String,
      trim:  true,
      lowercase: true,
      default: "",
    },
    website: {
      type:    String,
      default: null,
    },
    hours: {
      type:    String,
      default: "24 / 7",
    },
    isOpen: {
      type:    Boolean,
      default: true,
    },
    rating: {
      type:    Number,
      default: 0,
      min:     0,
      max:     5,
    },
    totalUnits: {
      type:    Number,
      default: 0,
      min:     0,
    },
    availability: {
      "A+":  { type: String, enum: availabilityEnum, default: "unavailable" },
      "A-":  { type: String, enum: availabilityEnum, default: "unavailable" },
      "B+":  { type: String, enum: availabilityEnum, default: "unavailable" },
      "B-":  { type: String, enum: availabilityEnum, default: "unavailable" },
      "O+":  { type: String, enum: availabilityEnum, default: "unavailable" },
      "O-":  { type: String, enum: availabilityEnum, default: "unavailable" },
      "AB+": { type: String, enum: availabilityEnum, default: "unavailable" },
      "AB-": { type: String, enum: availabilityEnum, default: "unavailable" },
    },
    isVerified: {
      type:    Boolean,
      default: false,
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ────────────────────────────────────────────
BloodBankSchema.index({ "location.district": 1 });
BloodBankSchema.index({ "location.coordinates": "2dsphere" });
BloodBankSchema.index({ isOpen: 1, isActive: 1 });
BloodBankSchema.index({ rating: -1 });

export default mongoose.model<IBloodBank>("BloodBank", BloodBankSchema);