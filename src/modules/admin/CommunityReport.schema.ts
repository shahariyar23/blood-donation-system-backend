import mongoose, { Schema, Document } from "mongoose";

export interface ICommunityReport extends Document {
  reportedBy:   mongoose.Types.ObjectId;
  reportedUser: mongoose.Types.ObjectId;
  reason:       "fake_profile" | "no_response" | "wrong_info" | "abusive" | "other";
  description:  string;
  status:       "pending" | "reviewed" | "dismissed" | "banned";
  reviewedBy:   mongoose.Types.ObjectId | null;
  reviewNote:   string;
  createdAt:    Date;
  updatedAt:    Date;
}

const CommunityReportSchema = new Schema<ICommunityReport>(
  {
    reportedBy: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    reportedUser: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    reason: {
      type:     String,
      enum:     ["fake_profile", "no_response", "wrong_info", "abusive", "other"],
      required: true,
    },
    description: {
      type:      String,
      trim:      true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default:   "",
    },
    status: {
      type:    String,
      enum:    ["pending", "reviewed", "dismissed", "banned"],
      default: "pending",
    },
    reviewedBy: {
      type:    Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },
    reviewNote: {
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
CommunityReportSchema.index({ reportedUser: 1 });
CommunityReportSchema.index({ reportedBy: 1 });
CommunityReportSchema.index({ status: 1 });
CommunityReportSchema.index({ createdAt: -1 });

export default mongoose.model<ICommunityReport>("CommunityReport", CommunityReportSchema);