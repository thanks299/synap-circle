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
      latitude: Number,
      longitude: Number,
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
      type: Number, // in meters
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
emergencyDirectorySchema.index({ type: 1, isVerified: 1 });
emergencyDirectorySchema.index({ coordinates: "2dsphere" });

export default mongoose.model("EmergencyDirectory", emergencyDirectorySchema);
