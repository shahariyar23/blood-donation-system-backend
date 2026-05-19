import mongoose, { Schema, Document } from "mongoose";

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-";

export interface IBloodBankApiConfig {
  name: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
  priority: number;
}

export interface IBloodBankSettings extends Document {
  singletonKey: string;
  isVisible: boolean;
  isMaintenance: boolean;
  maintenanceMessage: string;
  sectionTitle: string;
  notice: string;
  allowedBloodGroups: BloodGroup[];
  maxResults: number;
  requestTimeoutMs: number;
  apis: IBloodBankApiConfig[];
  createdAt: Date;
  updatedAt: Date;
}

export const BLOOD_GROUPS: BloodGroup[] = [
  "A+",
  "A-",
  "B+",
  "B-",
  "O+",
  "O-",
  "AB+",
  "AB-",
];

const BloodBankApiSchema = new Schema<IBloodBankApiConfig>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    baseUrl: {
      type: String,
      required: true,
      trim: true,
    },
    apiKey: {
      type: String,
      default: "",
      trim: true,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 100,
      min: 0,
    },
  },
  { _id: true },
);

const BloodBankSettingsSchema = new Schema<IBloodBankSettings>(
  {
    singletonKey: {
      type: String,
      default: "blood-bank-settings",
      unique: true,
      immutable: true,
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
    isMaintenance: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      default: "Blood Bank is temporarily unavailable.",
      trim: true,
    },
    sectionTitle: {
      type: String,
      default: "Blood Bank",
      trim: true,
    },
    notice: {
      type: String,
      default: "",
      trim: true,
    },
    allowedBloodGroups: {
      type: [String],
      enum: BLOOD_GROUPS,
      default: BLOOD_GROUPS,
    },
    maxResults: {
      type: Number,
      default: 20,
      min: 1,
      max: 100,
    },
    requestTimeoutMs: {
      type: Number,
      default: 8000,
      min: 1000,
      max: 30000,
    },
    apis: {
      type: [BloodBankApiSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export default mongoose.model<IBloodBankSettings>(
  "BloodBankSettings",
  BloodBankSettingsSchema,
);
