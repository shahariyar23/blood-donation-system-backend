import mongoose, { Schema, Document } from "mongoose";

// ── Hospital Record Types ──────────────────────────────
export interface IAuditLog {
  action: string;
  performedBy: mongoose.Types.ObjectId;
  performedAt: Date;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
}

// ── Hospital Document Interface ────────────────────────
export interface IHospital extends Document {
  // Hospital Basic Info
  hospitalName: string;
  registrationNumber: string;
  email: string;
  passwordHash: string;
  phone: string;
  website?: string;
  licenseNumber: string;
  // Admin Contact Info
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  // Hospital Capacity
  totalBedCapacity: number;
  bloodBankCapacity: number;
  // Status Fields
  isVerified: boolean;
  isActive: boolean;
  isDeleted: boolean;

  // Hospital Address & Location
  address: string;
  location: {
    area: string;
    district: string;
    division: string;
    coordinates: {
      type: "Point";
      coordinates: [number, number];
    };
  };
  // Password Reset
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
  // Refresh Token Control
  refreshTokenHash?: string | null;
  refreshTokenExpiresAt?: Date | null;
  // Audit Trail
  auditLogs: IAuditLog[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
// ── Audit Log Sub-Schema ───────────────────────────────
const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "hospital_created",
        "hospital_login",
        "hospital_updated",
        "hospital_verified",
        "donor_approved",
        "donor_rejected",
        "donor_cancelled",
        "donor_updated",
        "blood_collected",
        "blood_collection_added",
        "blood_collection_cancelled",
        "blood_donation_recorded",
        "blood_donation_cancelled",
        "blood_request_created",
        "blood_request_fulfilled",
        "blood_request_cancelled",
        "hospital_deleted",
      ],
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    performedAt: {
      type: Date,
      default: Date.now,
    },
    changes: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);
// ── Main Hospital Schema ───────────────────────────────
const HospitalSchema = new Schema<IHospital>(
  {
    // Basic Info
    hospitalName: {
      type: String,
      required: [true, "Hospital name is required"],
      trim: true,
      unique: true,
    },
    registrationNumber: {
      type: String,
      required: [true, "Registration number is required"],
      trim: true,
      unique: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: [true, "Password is required"],
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },
    website: {
      type: String,
      default: null,
      trim: true,
    },
    licenseNumber: {
      type: String,
      required: [true, "License number is required"],
      trim: true,
      unique: true,
    },
    // Admin Contact Info
    adminName: {
      type: String,
      required: [true, "Admin name is required"],
      trim: true,
    },
    adminEmail: {
      type: String,
      required: [true, "Admin email is required"],
      lowercase: true,
      trim: true,
    },
    adminPhone: {
      type: String,
      required: [true, "Admin phone is required"],
      trim: true,
    },
    // Hospital Capacity
    totalBedCapacity: {
      type: Number,
      default: 0,
    },
    bloodBankCapacity: {
      type: Number,
      default: 0,
    },
    // Status Fields
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },

    // Address & Location
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },
    location: {
      area: { type: String, default: "" },
      district: { type: String, default: "" },
      division: { type: String, default: "" },
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
          required: true,
        },
        coordinates: {
          type: [Number],
          required: true,
          validate: {
            validator: (value: number[]) => Array.isArray(value) && value.length === 2,
            message: "Coordinates must be [lng, lat]",
          },
        },
      },
    },
    // Password Reset
    passwordResetToken: {
      type: String,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
    // Refresh Token Control
    refreshTokenHash: {
      type: String,
      default: null,
    },
    refreshTokenExpiresAt: {
      type: Date,
      default: null,
    },
    // Audit Trail
    auditLogs: [AuditLogSchema],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ────────────────────────────────────────────
HospitalSchema.index({ "location.district": 1 });
HospitalSchema.index({ "location.coordinates": "2dsphere" });
HospitalSchema.index({ isVerified: 1, isActive: 1 });
HospitalSchema.index({ isDeleted: 1 });
HospitalSchema.index({ "bloodCollections.collectedAt": -1 });
HospitalSchema.index({ "bloodDonations.givenAt": -1 });
HospitalSchema.index({ "bloodRequests.requestedAt": -1 });
HospitalSchema.index({ "auditLogs.performedAt": -1 });

export default mongoose.model<IHospital>("Hospital", HospitalSchema);
