import mongoose, { Schema, Document } from "mongoose";

export interface IDeletedUser extends Document {
  userId: mongoose.Types.ObjectId;
  deletedBy: mongoose.Types.ObjectId | null;
  reason: string;
  userSnapshot: Record<string, any>;
  donorSnapshot: Record<string, any> | null;
  meta: {
    ip: string;
    userAgent: string;
  };
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeletedUserSchema = new Schema<IDeletedUser>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reason: {
      type: String,
      default: "user_requested",
      trim: true,
    },
    userSnapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
    donorSnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },
    meta: {
      ip: { type: String, default: "" },
      userAgent: { type: String, default: "" },
    },
    deletedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

DeletedUserSchema.index({ userId: 1 });
DeletedUserSchema.index({ deletedAt: -1 });

export default mongoose.model<IDeletedUser>("DeletedUser", DeletedUserSchema);
