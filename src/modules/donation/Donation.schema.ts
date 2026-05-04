import mongoose, { Schema, Document } from "mongoose";

// ── Audit Trail Sub-Interface ────────────────────────
export interface IAuditTrail {
  action: string;
  performedBy: mongoose.Types.ObjectId;
  performedAt: Date;
  changes?: Record<string, any>;
  notes?: string;
}

// ── Patient Information Sub-Interface ─────────────────
export interface IPatientInfo {
  name: string;
  address: string;
  phone: string;
  age?: number;
  gender?: "male" | "female" | "other";
  reasonForBlood: string;
  medicalCondition?: string;
  doctorName?: string;
  doctorPhone?: string;
}

export interface IDonation extends Document {
  donorId: mongoose.Types.ObjectId;
  hospitalId: mongoose.Types.ObjectId;
  requestedBy?: mongoose.Types.ObjectId | null;
  status: "request" | "pending" | "approved" | "rejected" | "completed" | "cancelled";
  approvedBy: mongoose.Types.ObjectId | null;
  approvedAt: Date | null;
  
  // Patient Information
  patientInfo: IPatientInfo;
  
  // Blood Details
  bloodType: string;
  units: number;
  donatedAt: Date | null;
  
  // Collection & Processing
  collectionId?: mongoose.Types.ObjectId;
  collectedBy?: mongoose.Types.ObjectId;
  collectedAt?: Date;
  
  // Notes & Reports
  reportNote?: string;
  notes: string;
  
  // Audit Trail
  auditTrail: IAuditTrail[];
  
  createdAt: Date;
  updatedAt: Date;
}

const AuditTrailSchema = new Schema<IAuditTrail>(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "donation_created",
        "donation_approved",
        "donation_rejected",
        "donation_collected",
        "donation_completed",
        "donation_cancelled",
        "donation_updated",
      ],
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    performedAt: {
      type: Date,
      default: Date.now,
    },
    changes: {
      type: Schema.Types.Mixed,
      default: {},
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const PatientInfoSchema = new Schema<IPatientInfo>(
  {
    name: {
      type: String,
      required: [true, "Patient name is required"],
      trim: true,
    },
    address: {
      type: String,
      required: [true, "Patient address is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Patient phone is required"],
      trim: true,
    },
    age: {
      type: Number,
      default: null,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
    },
    reasonForBlood: {
      type: String,
      required: [true, "Reason for blood is required"],
      trim: true,
    },
    medicalCondition: {
      type: String,
      default: "",
      trim: true,
    },
    doctorName: {
      type: String,
      default: "",
      trim: true,
    },
    doctorPhone: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const DonationSchema = new Schema<IDonation>(
  {
    donorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["request", "pending", "approved", "rejected"],
      default: "pending",
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    patientInfo: {
      type: PatientInfoSchema,
      required: true,
    },
    bloodType: {
      type: String,
      required: true,
      enum: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
    },
    units: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
    },
    donatedAt: {
      type: Date,
      default: null,
    },
    collectionId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    collectedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    collectedAt: {
      type: Date,
      default: null,
    },
    reportNote: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    auditTrail: [AuditTrailSchema],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ────────────────────────────────────────────
DonationSchema.index({ hospitalId: 1, _id: -1 });
DonationSchema.index({ donorId: 1, donatedAt: -1 });
DonationSchema.index({ hospitalId: 1, status: 1, createdAt: -1 });
DonationSchema.index({ hospitalId: 1, donorId: 1, bloodType: 1, status: 1, createdAt: -1 });
DonationSchema.index({ bloodType: 1 });

export default mongoose.model<IDonation>("Donation", DonationSchema);