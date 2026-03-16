import mongoose, { Schema, Document } from "mongoose";

export interface IDonation extends Document {
  donor:           mongoose.Types.ObjectId;
  request:         mongoose.Types.ObjectId;
  bloodType:       string;
  units:           number;
  hospital:        string;
  donatedAt:       Date;
  verifiedByBank:  boolean;
  notes:           string;
  createdAt:       Date;
}

const DonationSchema = new Schema<IDonation>(
  {
    donor: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    request: {
      type:     Schema.Types.ObjectId,
      ref:      "BloodRequest",
      required: true,
    },
    bloodType: {
      type:     String,
      required: true,
      enum:     ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
    },
    units: {
      type:    Number,
      default: 1,
      min:     1,
      max:     10,
    },
    hospital: {
      type:     String,
      required: true,
      trim:     true,
    },
    donatedAt: {
      type:    Date,
      default: Date.now,
    },
    verifiedByBank: {
      type:    Boolean,
      default: false,
    },
    notes: {
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
DonationSchema.index({ donor: 1, donatedAt: -1 });
DonationSchema.index({ request: 1 });
DonationSchema.index({ bloodType: 1 });

export default mongoose.model<IDonation>("Donation", DonationSchema);