import mongoose, { Schema, Document } from "mongoose";

export interface IDonation extends Document {
  donorId: mongoose.Types.ObjectId;
  hospitalId: mongoose.Types.ObjectId;
  status: "pending" | "approved" | "rejected";
  approvedBy: mongoose.Types.ObjectId | null;
  approvedAt: Date | null;
  patientInfo?: string;
  reportNote?: string;
  bloodType: string;
  units: number;
  donatedAt: Date | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const DonationSchema = new Schema<IDonation>(
  {
    donorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    patientInfo: {
      type: String,
      default: "",
      trim: true,
    },
    reportNote: {
      type: String,
      default: "",
      trim: true,
    },
    bloodType: {
      type:     String,
      required: true,
      enum:     ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
    },
    units: {
      type:    Number,
      default: 1,
      min:     1,
      max:     10,
    },
    donatedAt: {
      type:    Date,
      default: null,
    },
    notes: {
      type:    String,
      default: "",
      trim:    true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ────────────────────────────────────────────
DonationSchema.index({ donorId: 1, donatedAt: -1 });
DonationSchema.index({ hospitalId: 1, status: 1, createdAt: -1 });
DonationSchema.index({ bloodType: 1 });

export default mongoose.model<IDonation>("Donation", DonationSchema);