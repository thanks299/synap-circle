import { body, validationResult } from "express-validator";
import { PHONE_REGEX, EMAIL_REGEX } from "../utils/regex.js";

// Validation rules
const validatePhoneNumber = (value) => {
  if (!PHONE_REGEX.test(value)) {
    throw new Error("Invalid phone number format");
  }
  return true;
};

const validateEmail = (value) => {
  if (!EMAIL_REGEX.test(value)) {
    throw new Error("Invalid email format");
  }
  return true;
};

const validateEmailSecure = (value) => {
  if (!value || typeof value !== "string") {
    throw new Error("Invalid email format");
  }

  // Basic but safe validation
  const parts = value.split("@");
  if (parts.length !== 2) {
    throw new Error("Invalid email format");
  }

  const [local, domain] = parts;
  if (local.length === 0 || domain.length === 0) {
    throw new Error("Invalid email format");
  }

  if (!domain.includes(".")) {
    throw new Error("Invalid email format");
  }

  return true;
};

// Validation schemas
const authValidation = {
  signup: [
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please enter a valid email address")
      .normalizeEmail(),
    body("phoneNumber")
      .notEmpty()
      .withMessage("Phone number is required")
      .custom(validatePhoneNumber),
    body("name")
      .optional()
      .isLength({ max: 100 })
      .withMessage("Name cannot exceed 100 characters"),
  ],

  verifyOTP: [
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please enter a valid email"),
    body("otpCode")
      .notEmpty()
      .withMessage("OTP code is required")
      .isLength({ min: 6, max: 6 })
      .withMessage("OTP must be 6 digits")
      .isNumeric()
      .withMessage("OTP must be numeric"),
  ],

  resendOTP: [
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please enter a valid email"),
  ],

  forgotPassword: [
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please enter a valid email address")
      .normalizeEmail(),
  ],

  verifyResetOTP: [
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please enter a valid email"),
    body("otpCode")
      .notEmpty()
      .withMessage("OTP code is required")
      .isLength({ min: 6, max: 6 })
      .withMessage("OTP must be 6 digits")
      .isNumeric()
      .withMessage("OTP must be numeric"),
  ],

  resetPassword: [
    body("resetToken").notEmpty().withMessage("Reset token is required"),
    body("newPassword")
      .notEmpty()
      .withMessage("New password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/)
      .withMessage("Password must contain at least one letter and one number"),
    body("confirmPassword")
      .notEmpty()
      .withMessage("Please confirm your password")
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage("Passwords do not match"),
  ],

  changePassword: [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .notEmpty()
      .withMessage("New password is required")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/)
      .withMessage("Password must contain at least one letter and one number"),
    body("confirmPassword")
      .notEmpty()
      .withMessage("Please confirm your password")
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage("Passwords do not match"),
  ],
};

const contactValidation = {
  create: [
    body("name")
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ max: 100 })
      .withMessage("Name cannot exceed 100 characters"),
    body("phoneNumber")
      .notEmpty()
      .withMessage("Phone number is required")
      .custom(validatePhoneNumber),
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please enter a valid email address"),
    body("relationship")
      .notEmpty()
      .withMessage("Relationship is required")
      .isIn(["parent", "sibling", "friend", "roommate", "partner", "other"])
      .withMessage("Invalid relationship type"),
  ],

  update: [
    body("name")
      .optional()
      .isLength({ max: 100 })
      .withMessage("Name cannot exceed 100 characters"),
    body("phoneNumber").optional().custom(validatePhoneNumber),
    body("email")
      .optional()
      .isEmail()
      .withMessage("Please enter a valid email address"),
    body("relationship")
      .optional()
      .isIn(["parent", "sibling", "friend", "roommate", "partner", "other"])
      .withMessage("Invalid relationship type"),
  ],
};

const sosValidation = {
  trigger: [
    body("latitude")
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage("Invalid latitude"),
    body("longitude")
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage("Invalid longitude"),
    body("locationAvailable")
      .optional()
      .isBoolean()
      .withMessage("locationAvailable must be boolean"),
  ],

  cancel: [
    body("reason")
      .optional()
      .isIn(["false_alarm", "resolved", "user_error"])
      .withMessage("Invalid cancellation reason"),
  ],
};

// Validation result handler
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Format errors
    const formattedErrors = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
    }));

    return res.status(400).json({
      success: false,
      message: formattedErrors[0]?.message || "Validation failed",
      errors: formattedErrors,
    });
  };
};

export {
  validate,
  authValidation,
  contactValidation,
  sosValidation,
  validatePhoneNumber,
  validateEmail,
};
