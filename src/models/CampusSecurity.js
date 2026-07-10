import mongoose from "mongoose";

const campusSecuritySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Security name is required"],
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },
    location: {
      type: String,
      trim: true,
    },
    coordinates: {
      latitude: Number,
      longitude: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
    },
    operatingHours: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
campusSecuritySchema.index({ isActive: 1, isPrimary: 1 });

export default mongoose.model("CampusSecurity", campusSecuritySchema);
