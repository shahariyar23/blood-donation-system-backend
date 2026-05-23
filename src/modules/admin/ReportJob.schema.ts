import mongoose, { Document, Schema } from "mongoose";

export type ReportSection =
  | "users"
  | "deleted-users"
  | "blood-requests"
  | "donations"
  | "hospitals"
  | "reports"
  | "verifications";

export type ReportFormat = "pdf" | "csv";

export type ReportJobStatus =
  | "pending"
  | "processing"
  | "ready"
  | "downloaded"
  | "failed";

export interface IReportJob extends Document {
  section: ReportSection;
  format: ReportFormat;
  status: ReportJobStatus;
  requestedBy: mongoose.Types.ObjectId;
  requestedAt: Date;
  completedAt: Date | null;
  downloadedAt: Date | null;
  downloadCount: number;
  filtersApplied: Record<string, any>;
  totalRecords: number;
  errorMessage: string | null;
  fileSize: number | null;
  filePath: string | null;
  fileName: string | null;
  contentType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ReportJobSchema = new Schema<IReportJob>(
  {
    section: {
      type: String,
      enum: [
        "users",
        "deleted-users",
        "blood-requests",
        "donations",
        "hospitals",
        "reports",
        "verifications",
      ],
      required: true,
      index: true,
    },
    format: {
      type: String,
      enum: ["pdf", "csv"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "ready", "downloaded", "failed"],
      default: "pending",
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    downloadedAt: {
      type: Date,
      default: null,
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    filtersApplied: {
      type: Schema.Types.Mixed,
      default: {},
    },
    totalRecords: {
      type: Number,
      default: 0,
      min: 0,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    filePath: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    contentType: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

ReportJobSchema.index({ section: 1, status: 1, requestedAt: -1 });

export default mongoose.model<IReportJob>("ReportJob", ReportJobSchema);
