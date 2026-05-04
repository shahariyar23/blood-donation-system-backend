import mongoose, { Schema, Document } from "mongoose";

export interface IDonor extends Document {
  userId: mongoose.Types.ObjectId;
  isAvailable: boolean;
  lastDonationDate: Date | null;
  nextAvailableAt: Date | null;
  totalDonations: number;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DonorSchema = new Schema<IDonor>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    // isAvailable: {
    //   type: Boolean,
    //   default: false,
    // },
    lastDonationDate: {
      type: Date,
      default: null,
    },
    nextAvailableAt: {
      type: Date,
      default: null,
    },
    totalDonations: {
      type: Number,
      default: 0,
      min: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);
// ── auto-calculates from nextAvailableAt ──
DonorSchema.virtual("isAvailable").get(function () {
  if (!this.nextAvailableAt) return true;        // never donated → available
  return new Date() >= this.nextAvailableAt;     // 90 days passed → available
});

DonorSchema.index({ isVerified: 1, nextAvailableAt: 1 });

// DonorSchema.index({ isAvailable: 1, isVerified: 1, nextAvailableAt: 1 });

const Donor = mongoose.model<IDonor>("Donor", DonorSchema);
export default Donor;
