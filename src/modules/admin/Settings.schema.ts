import mongoose, { Schema, Document } from "mongoose";

export interface ISettings extends Document {
  appName: string;
  version: string;
  maintenanceMode: boolean;
  donationEligibilityDays: number;
  autoEmailNotifications: boolean;
  emailNotificationDelay: number;
  minDonorsPerBank: number;
  maxRequestsPerDay: number;
  requestExpirationDays: number;
  maxReportsPerDay: number;
  minCommunityFlagsToBlock: number;
  autoVerifyDonors: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    appName: {
      type: String,
      default: "BloodConnect",
      trim: true,
    },
    version: {
      type: String,
      default: "1.0.0",
      trim: true,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    donationEligibilityDays: {
      type: Number,
      default: 90,
      min: [1, "Donation eligibility days must be at least 1"],
    },
    autoEmailNotifications: {
      type: Boolean,
      default: true,
    },
    emailNotificationDelay: {
      type: Number,
      default: 24,
      min: [1, "Email notification delay must be at least 1 hour"],
    },
    minDonorsPerBank: {
      type: Number,
      default: 50,
      min: [0, "Minimum donors per bank cannot be negative"],
    },
    maxRequestsPerDay: {
      type: Number,
      default: 100,
      min: [1, "Maximum requests per day must be at least 1"],
    },
    requestExpirationDays: {
      type: Number,
      default: 7,
      min: [1, "Request expiration days must be at least 1"],
    },
    maxReportsPerDay: {
      type: Number,
      default: 5,
      min: [1, "Maximum reports per day must be at least 1"],
    },
    minCommunityFlagsToBlock: {
      type: Number,
      default: 10,
      min: [1, "Minimum community flags to block must be at least 1"],
    },
    autoVerifyDonors: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<ISettings>("Settings", SettingsSchema);
