import mongoose from "mongoose";
import { EMAIL_REGEX } from "../utils/regex.js";

const emergencyDirectorySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, "Type is required"],
      enum: ["security", "hospital", "police", "ambulance", "fire"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, "Please enter a valid email"],
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    coordinates: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        index: "2dsphere",
        default: [0, 0],
      },
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
    },
    operatingHours: {
      type: String,
      trim: true,
    },
    distance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Create 2dsphere index for geospatial queries
emergencyDirectorySchema.index({ coordinates: "2dsphere" });
emergencyDirectorySchema.index({ type: 1, isVerified: 1 });

emergencyDirectorySchema.virtual("lat").get(function () {
  return this.coordinates?.coordinates?.[1] || this.latitude || 0;
});

emergencyDirectorySchema.virtual("lng").get(function () {
  return this.coordinates?.coordinates?.[0] || this.longitude || 0;
});

export default mongoose.model("EmergencyDirectory", emergencyDirectorySchema);
