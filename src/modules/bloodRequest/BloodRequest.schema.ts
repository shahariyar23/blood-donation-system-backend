import mongoose, { Schema, Document } from "mongoose";

export interface IBloodRequest extends Document {
  requestedBy: mongoose.Types.ObjectId;
  patientName: string;
  bloodType: string;
  units: number;
  hospital: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  locationDetails: any | null;
  phone: string;
  urgency: "critical" | "urgent" | "moderate" | "planned";
  neededBy: Date;
  expiresAt: Date;
  notes: string;
  agreeTerms: boolean;
  status: "active" | "fulfilled" | "expired" | "cancelled";
  respondedDonors: mongoose.Types.ObjectId[];
  fulfilledBy: mongoose.Types.ObjectId | null;
  isExpired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BloodRequestSchema = new Schema<IBloodRequest>(
  {
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    patientName: {
      type: String,
      required: [true, "Patient name is required"],
      trim: true,
    },
    bloodType: {
      type: String,
      required: [true, "Blood type is required"],
      enum: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
    },
    units: {
      type: Number,
      required: [true, "Units required"],
      min: [1, "Minimum 1 unit"],
      max: [10, "Maximum 10 units"],
      default: 1,
    },
    hospital: {
      type: String,
      required: [true, "Hospital name is required"],
      trim: true,
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    locationDetails: {
      type: Schema.Types.Mixed,
      default: null,
    },
    phone: {
      type: String,
      required: [true, "Contact number is required"],
      trim: true,
    },
    urgency: {
      type: String,
      enum: ["critical", "urgent", "moderate", "planned"],
      required: true,
    },
    neededBy: {
      type: Date,
      required: [true, "Needed by date is required"],
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    agreeTerms: {
      type: Boolean,
      required: [true, "You must agree to the terms"],
      validate: {
        validator: (value: boolean) => value === true,
        message: "You must agree to the terms",
      },
    },
    status: {
      type: String,
      enum: ["active", "fulfilled", "expired", "cancelled"],
      default: "active",
    },
    respondedDonors: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    fulfilledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isExpired: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ── Indexes ────────────────────────────────────────────
BloodRequestSchema.index({ bloodType: 1, status: 1 });
BloodRequestSchema.index({ status: 1, expiresAt: 1 });
BloodRequestSchema.index({ requestedBy: 1, status: 1, createdAt: -1 });
BloodRequestSchema.index({ urgency: 1, status: 1 });
BloodRequestSchema.index({ neededBy: 1 });
BloodRequestSchema.index({ createdAt: -1 });

export default mongoose.model<IBloodRequest>(
  "BloodRequest",
  BloodRequestSchema,
);
