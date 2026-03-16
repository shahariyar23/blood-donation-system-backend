import mongoose, { Schema, Document } from "mongoose";

export interface IUserActivity extends Document {
  userId:    mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  event:     string;
  meta:      Record<string, any>;
  ip:        string;
  userAgent: string;
  timestamp: Date;
}

const UserActivitySchema = new Schema<IUserActivity>(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref:  "Session",
    },
    event: {
      type:     String,
      required: true,
      enum: [
        // auth
        "register", "login", "logout", "login_failed", "password_reset",
        // donor
        "donor_search", "donor_view", "donor_contact", "availability_toggle",
        // request
        "request_create", "request_view", "request_respond", "request_cancel",
        // bank
        "bank_search", "bank_view", "bank_call", "bank_directions",
        // profile
        "profile_view", "profile_update", "avatar_upload",
        // page
        "page_view", "page_exit",
        // system
        "notification_read", "report_submit", "account_delete",
      ],
    },
    meta: {
      type:    Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type:    String,
      default: "",
    },
    userAgent: {
      type:    String,
      default: "",
    },
    timestamp: {
      type:    Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    // no timestamps — we use our own timestamp field
  }
);

// ── Indexes ────────────────────────────────────────────
UserActivitySchema.index({ userId: 1, timestamp: -1 });
UserActivitySchema.index({ sessionId: 1 });
UserActivitySchema.index({ event: 1 });
UserActivitySchema.index({ timestamp: -1 });
// Auto-delete activity logs after 90 days
UserActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export default mongoose.model<IUserActivity>("UserActivity", UserActivitySchema);