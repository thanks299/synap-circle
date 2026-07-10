import mongoose from "mongoose";

const alertRecipientSchema = new mongoose.Schema(
  {
    alertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SOSAlert",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientType: {
      type: String,
      enum: ["trusted_contact", "campus_security"],
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
    },
    emailStatus: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed"],
      default: "pending",
    },
    emailSentAt: {
      type: Date,
    },
    emailError: {
      type: String,
    },
    smsStatus: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed"],
      default: "pending",
    },
    smsSentAt: {
      type: Date,
    },
    smsError: {
      type: String,
    },
    delivered: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
alertRecipientSchema.index({ alertId: 1 });
alertRecipientSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("AlertRecipient", alertRecipientSchema);
