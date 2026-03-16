import mongoose, { Schema, Document } from "mongoose";

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  device: {
    type:      string;
    brand:     string;
    model:     string;
    os:        string;
    osVersion: string;
  };
  browser: {
    name:           string;
    version:        string;
    engine:         string;
    language:       string;
    cookiesEnabled: boolean;
    doNotTrack:     boolean;
    userAgent:      string;
  };
  screen: {
    width:       number;
    height:      number;
    colorDepth:  number;
    pixelRatio:  number;
    orientation: string;
  };
  network: {
    ip:            string;
    ipv6:          string | null;
    type:          string;
    effectiveType: string;
    downlink:      number | null;
    isp:           string | null;
    proxy:         boolean;
    vpn:           boolean;
    tor:           boolean;
  };
  location: {
    country:     string;
    countryCode: string;
    division:    string;
    district:    string;
    city:        string;
    timezone:    string;
    coordinates: { lat: number; lng: number };
    accuracy:    string;
  };
  token:          string;
  refreshToken:   string;
  tokenExpiresAt: Date;
  loginMethod:    "email" | "phone" | "google" | "facebook";
  isActive:       boolean;
  lastActiveAt:   Date;
  loggedOutAt:    Date | null;
  createdAt:      Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    device: {
      type:      { type: String, default: "unknown" },
      brand:     { type: String, default: "unknown" },
      model:     { type: String, default: "unknown" },
      os:        { type: String, default: "unknown" },
      osVersion: { type: String, default: "unknown" },
    },
    browser: {
      name:           { type: String,  default: "unknown" },
      version:        { type: String,  default: "unknown" },
      engine:         { type: String,  default: "unknown" },
      language:       { type: String,  default: "unknown" },
      cookiesEnabled: { type: Boolean, default: false },
      doNotTrack:     { type: Boolean, default: false },
      userAgent:      { type: String,  default: "" },
    },
    screen: {
      width:       { type: Number, default: 0 },
      height:      { type: Number, default: 0 },
      colorDepth:  { type: Number, default: 0 },
      pixelRatio:  { type: Number, default: 1 },
      orientation: { type: String, default: "unknown" },
    },
    network: {
      ip:            { type: String,  required: true },
      ipv6:          { type: String,  default: null },
      type:          { type: String,  default: "unknown" },
      effectiveType: { type: String,  enum: ["slow-2g", "2g", "3g", "4g", "unknown"], default: "unknown" },
      downlink:      { type: Number,  default: null },
      isp:           { type: String,  default: null },
      proxy:         { type: Boolean, default: false },
      vpn:           { type: Boolean, default: false },
      tor:           { type: Boolean, default: false },
    },
    location: {
      country:     { type: String, default: "" },
      countryCode: { type: String, default: "" },
      division:    { type: String, default: "" },
      district:    { type: String, default: "" },
      city:        { type: String, default: "" },
      timezone:    { type: String, default: "" },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
      accuracy: { type: String, default: "city-level" },
    },
    token: {
      type:     String,
      required: true,
      select:   false,
    },
    refreshToken: {
      type:     String,
      required: true,
      select:   false,
    },
    tokenExpiresAt: {
      type:     Date,
      required: true,
    },
    loginMethod: {
      type: String,
      enum: ["email", "phone", "google", "facebook"],
      default: "email",
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
    lastActiveAt: {
      type:    Date,
      default: Date.now,
    },
    loggedOutAt: {
      type:    Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Indexes ────────────────────────────────────────────
SessionSchema.index({ userId: 1 });
SessionSchema.index({ "network.ip": 1 });
SessionSchema.index({ isActive: 1 });
SessionSchema.index({ tokenExpiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-delete

export default mongoose.model<ISession>("Session", SessionSchema);