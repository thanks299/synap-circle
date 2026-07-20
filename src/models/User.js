import mongoose from "mongoose";
import { PHONE_REGEX, EMAIL_REGEX } from "../utils/regex.js";

const userSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      match: [PHONE_REGEX, "Please enter a valid phone number"],
    },
    email: {
      type: String,
      required: [true, "Email is required for OTP"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, "Please enter a valid email"],
    },
    password: {
      type: String,
      select: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    profilePicture: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    deviceInfo: {
      type: String,
    },
    universityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "University",
      index: true,
    },
    selectedUniversity: {
      type: String,
      trim: true,
    },
    onboardingStep: {
      type: String,
      enum: ["welcome", "location", "university", "contacts", "complete"],
      default: "welcome",
    },
    preferences: {
      autoShareLocation: {
        type: Boolean,
        default: true,
      },
      alertSound: {
        type: Boolean,
        default: true,
      },
      onboardingLocation: {
        type: {
          latitude: Number,
          longitude: Number,
          updatedAt: Date,
        },
        default: null,
      },
    },
    passwordResetAt: {
      type: Date,
    },
    lastPasswordChange: {
      type: Date,
    },
    refreshTokens: [
      {
        token: {
          type: String,
          required: true,
        },
        expiresAt: {
          type: Date,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        deviceInfo: {
          type: String,
          default: "Unknown device",
        },
        isRevoked: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes
userSchema.index({ phoneNumber: 1 });
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });

// Method to get safe user data
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.__v;
  delete user.password;
  return user;
};

userSchema.methods.getSecurityContacts = async function () {
  if (!this.universityId) {
    const CampusSecurity = mongoose.model("CampusSecurity");
    return await CampusSecurity.find({ isActive: true });
  }

  const University = mongoose.model("University");
  const university = await University.findById(this.universityId);
  if (!university) {
    return [];
  }

  return await university.getAllSecurityContacts();
};

// Added method to clean expired refresh tokens
userSchema.methods.cleanExpiredRefreshTokens = function () {
  this.refreshTokens = this.refreshTokens.filter(
    (rt) => rt.expiresAt > new Date() && !rt.isRevoked,
  );
  return this;
};

// Added method to revoke all refresh tokens for a user
userSchema.methods.revokeAllRefreshTokens = function () {
  this.refreshTokens = [];
  return this;
};

userSchema.methods.canResetPassword = function () {
  // If user hasn't set a password yet, allow reset
  if (!this.password) return true;
  if (this.lastPasswordChange) {
    const minutesSinceChange =
      (Date.now() - this.lastPasswordChange.getTime()) / 60000;
    if (minutesSinceChange < 1) {
      return false;
    }
  }
  // Check if user is active
  if (!this.isActive) {
    return false;
  }

  return true;
};

export default mongoose.model("User", userSchema);
