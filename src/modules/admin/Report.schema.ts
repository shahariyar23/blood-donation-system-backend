import mongoose, { Schema, Document } from "mongoose";

export interface IReport extends Document {
  reason: string;
  description: string;
  status: "pending" | "reviewed" | "dismissed";
  reportedBy: mongoose.Types.ObjectId;
  reportedUser: mongoose.Types.ObjectId;
  reviewedBy: mongoose.Types.ObjectId | null;
  reviewNote: string;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "dismissed"],
      default: "pending",
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewNote: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model<IReport>("Report", reportSchema);