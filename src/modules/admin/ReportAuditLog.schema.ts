import mongoose, { Document, Schema } from "mongoose";

export type ReportAuditAction = "requested" | "downloaded" | "failed";

export interface IReportAuditLog extends Document {
  jobId: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId;
  adminName: string;
  adminEmail: string;
  section: string;
  format: string;
  action: ReportAuditAction;
  timestamp: Date;
  ip: string;
  userAgent: string;
  filters: Record<string, any>;
}

const ReportAuditLogSchema = new Schema<IReportAuditLog>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "ReportJob",
      required: true,
      index: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    adminName: {
      type: String,
      default: "",
    },
    adminEmail: {
      type: String,
      default: "",
    },
    section: {
      type: String,
      required: true,
      index: true,
    },
    format: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: ["requested", "downloaded", "failed"],
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ip: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
    filters: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { versionKey: false },
);

ReportAuditLogSchema.index({ adminId: 1, timestamp: -1 });
ReportAuditLogSchema.index({ section: 1, action: 1, timestamp: -1 });

export default mongoose.model<IReportAuditLog>("ReportAuditLog", ReportAuditLogSchema);
