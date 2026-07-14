import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    otpCode: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: "10m" },
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    purpose: {
      type: String,
      enum: ["signup", "login", "reset", "reset_password"],
      default: "signup",
    },
    isPasswordReset: {
      type: Boolean,
      default: false,
    },
    pendingPassword: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
otpSchema.index({ phoneNumber: 1, otpCode: 1 });
otpSchema.index({ email: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ purpose: 1, isUsed: 1 });

// Method to check if OTP is valid for password reset
otpSchema.methods.isValidForPasswordReset = function () {
  return (
    this.purpose === "reset_password" &&
    !this.isUsed &&
    this.expiresAt > new Date()
  );
};

// Pre-save middleware to ensure reset OTPs are properly handled
otpSchema.pre("save", function (next) {
  if (this.purpose === "reset_password" && !this.isPasswordReset) {
    this.isPasswordReset = true;
  }
  next();
});

export default mongoose.model("OTP", otpSchema);
