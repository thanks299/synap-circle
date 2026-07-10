import mongoose from "mongoose";

const trustedContactSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number"],
    },
    email: {
      type: String,
      required: [true, "Email is required for alerts"],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    relationship: {
      type: String,
      required: [true, "Relationship is required"],
      trim: true,
      enum: ["parent", "sibling", "friend", "roommate", "partner", "other"],
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Composite index for user and contact
trustedContactSchema.index({ userId: 1, phoneNumber: 1 }, { unique: true });
trustedContactSchema.pre("save", async function (next) {
  const isBecomingActive = this.isNew
    ? this.isActive
    : this.isModified("isActive") && this.isActive;

  if (!isBecomingActive) {
    return next();
  }

  const count = await mongoose.model("TrustedContact").countDocuments({
    userId: this.userId,
    isActive: true,
    _id: { $ne: this._id },
  });

  const MAX_CONTACTS = Number.parseInt(process.env.MAX_TRUSTED_CONTACTS) || 3;

  if (count >= MAX_CONTACTS) {
    const error = new Error(
      `You can only have up to ${MAX_CONTACTS} trusted contacts`,
    );
    error.statusCode = 400;
    return next(error);
  }
  next();
});

// Method to safely return contact data
trustedContactSchema.methods.toJSON = function () {
  const contact = this.toObject({ virtuals: true });
  delete contact.__v;
  return contact;
};

export default mongoose.model("TrustedContact", trustedContactSchema);
