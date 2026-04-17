import mongoose, { Schema, Document } from "mongoose";

export interface IDonor extends Document {
  userId: mongoose.Types.ObjectId;
  bloodType: string;
  isAvailable: boolean;
  lastDonationDate: Date | null;
  totalDonations: number;
  location: {
    displayName: string;
    city: string;
    state: string;
    country: string;
    coordinates:
      | {
          type: "Point";
          coordinates: [number, number];
        }
      | null;
  };
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
    bloodType: {
      type: String,
      required: [true, "Blood type is required"],
      enum: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    lastDonationDate: {
      type: Date,
      default: null,
    },
    totalDonations: {
      type: Number,
      default: 0,
      min: 0,
    },
    location: {
      displayName: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
        },
        coordinates: {
          type: [Number],
          validate: {
            validator: (value: number[] | undefined) =>
              value === undefined || value.length === 2,
            message: "GeoJSON coordinates must contain [lng, lat]",
          },
        },
      },
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

// Index for geo-spatial searches if needed later
DonorSchema.index({ "location.coordinates": "2dsphere" });
DonorSchema.index({ bloodType: 1, isAvailable: 1, isVerified: 1 });

const Donor = mongoose.model<IDonor>("Donor", DonorSchema);
export default Donor;
