import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  userId:       mongoose.Types.ObjectId;
  type:         "blood_request" | "donor_response" | "request_fulfilled" | "system";
  title:        string;
  message:      string;
  relatedId:    mongoose.Types.ObjectId | null;
  relatedModel: "BloodRequest" | "User" | "Donation" | null;
  isRead:       boolean;
  createdAt:    Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    type: {
      type:     String,
      enum:     ["blood_request", "donor_response", "request_fulfilled", "system"],
      required: true,
    },
    title: {
      type:     String,
      required: true,
      trim:     true,
    },
    message: {
      type:     String,
      required: true,
      trim:     true,
    },
    relatedId: {
      type:    Schema.Types.ObjectId,
      default: null,
      refPath: "relatedModel",
    },
    relatedModel: {
      type:    String,
      enum:    ["BloodRequest", "User", "Donation", null],
      default: null,
    },
    isRead: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ────────────────────────────────────────────
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
// Auto-delete notifications after 30 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.model<INotification>("Notification", NotificationSchema);