import mongoose, { Schema, Document } from "mongoose";

export interface IVerification extends Document {
  userId: mongoose.Types.ObjectId;
  documentType: "donor_license" | "health_certificate" | "identity_card" | "other";
  documentUrl: string;
  status: "pending" | "verified" | "rejected";
  submittedAt: Date;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const VerificationSchema = new Schema<IVerification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    documentType: {
      type: String,
      enum: ["donor_license", "health_certificate", "identity_card", "other"],
      required: true,
    },
    documentUrl: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    submittedAt: {
      type: Date,
      default: () => new Date(),
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<IVerification>("Verification", VerificationSchema);
