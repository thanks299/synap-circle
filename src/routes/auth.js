import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import TrustedContact from "../models/TrustedContact.js";
import emailService from "../services/emailService.js";
import OTP from "../models/OTP.js";
import { validate, authValidation } from "../middlewares/validator.js";
import { authenticate } from "../middlewares/auth.js";
import { otpLimiter, authLimiter } from "../middlewares/rateLimiter.js";
import { body } from "express-validator";
import { asyncHandler } from "../utils/asyncHandler.js";
import config from "../utils/config.js";

const router = express.Router();

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Send OTP for signup
 *     description: Creates a user and sends a 6-digit OTP to their email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupRequest'
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: OTP sent successfully to your email
 *       400:
 *         description: Validation error or user already exists
 *       429:
 *         description: Too many requests
 */
router.post(
  "/signup",
  authLimiter,
  validate(authValidation.signup),
  asyncHandler(async (req, res, next) => {
    try {
      const { email, phoneNumber, name, password } = req.body;

      // Validate email is provided
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required for OTP verification.",
        });
      }

      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password is required.",
        });
      }

      const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
      if (!passwordPattern.test(password)) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 8 characters long and contain at least one letter and one number.",
        });
      }

      // Check if this email is already tied to a DIFFERENT phone number.
      const existingEmail = await User.findOne({ email });
      if (existingEmail && existingEmail.phoneNumber !== phoneNumber) {
        return res.status(400).json({
          success: false,
          message: "Email already registered. Please use a different email.",
        });
      }

      // Check if this phone number is already tied to a DIFFERENT email
      const existingPhone = await User.findOne({ phoneNumber });
      if (existingPhone && existingPhone.email !== email) {
        return res.status(400).json({
          success: false,
          message: "Phone number already registered. Please log in.",
        });
      }

      // Find or create user
      let user = existingPhone || existingEmail;

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      if (user && !user.isVerified) {
        user.name = name || user.name;
        user.email = email || user.email;
        user.phoneNumber = phoneNumber || user.phoneNumber;
        user.password = hashedPassword;
        user.lastPasswordChange = new Date();
        await user.save();
      } else if (!user) {
        await User.create({
          email,
          phoneNumber,
          name: name || "",
          password: hashedPassword,
          isVerified: false,
        });
      }

      // Send OTP via email
      const result = await emailService.sendOTP(email, phoneNumber, "signup");
      const response = {
        success: true,
        message: result.message || "OTP sent successfully to your email",
      };

      if (config.isDevelopment && result.development_otp) {
        response.development_otp = result.development_otp;
      }

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }),
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     description: Authenticates a user with email and password, returns a JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: No password set on this account
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account deactivated
 *       429:
 *         description: Too many attempts
 */
router.post(
  "/login",
  authLimiter,
  validate(authValidation.login),
  asyncHandler(async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password.",
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Account is deactivated. Please contact support.",
        });
      }

      if (!user.password) {
        return res.status(400).json({
          success: false,
          message:
            "No password set for this account yet. Log in with OTP and set a password from your profile, or use forgot-password.",
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password.",
        });
      }

      const token = jwt.sign(
        { userId: user._id, email: user.email },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn || "7d" },
      );

      user.lastLogin = new Date();
      await user.save();

      res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user._id,
          phoneNumber: user.phoneNumber,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
        },
      });
    } catch (error) {
      next(error);
    }
  }),
);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and complete signup/login
 *     description: Verifies the OTP sent to email and returns a JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otpCode
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student@campus.edu
 *               otpCode:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 */
router.post(
  "/verify-otp",
  authLimiter,
  validate(authValidation.verifyOTP),
  asyncHandler(async (req, res, next) => {
    try {
      const { email, otpCode } = req.body;

      // Verify OTP using email
      const result = await emailService.verifyOTP(email, otpCode);

      // Generate JWT token
      const token = jwt.sign(
        { userId: result.user._id, email: result.user.email },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn || "7d" },
      );

      // Update last login
      result.user.lastLogin = new Date();
      await result.user.save();

      res.status(200).json({
        success: true,
        message: "OTP verified successfully",
        token,
        user: {
          id: result.user._id,
          phoneNumber: result.user.phoneNumber,
          name: result.user.name,
          email: result.user.email,
          isVerified: result.user.isVerified,
        },
      });
    } catch (error) {
      // Handle known errors gracefully
      if (error.message === "Invalid or expired OTP") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message === "User not found") {
        return res.status(404).json({
          success: false,
          message: "User not found. Please sign up first.",
        });
      }
      next(error);
    }
  }),
);

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     summary: Resend OTP
 *     description: Resends a new OTP to the user's registered email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student@campus.edu
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Email not found
 *       429:
 *         description: Too many requests
 */
router.post(
  "/resend-otp",
  otpLimiter,
  validate(authValidation.resendOTP),
  asyncHandler(async (req, res, next) => {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Email not found. Please sign up first.",
        });
      }

      const result = await emailService.resendOTP(email, user.phoneNumber);

      const response = {
        success: true,
        message: "OTP resent successfully to your email",
      };

      if (config.isDevelopment && result.development_otp) {
        response.development_otp = result.development_otp;
      }

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }),
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Logs out the user (client-side token removal)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post(
  "/logout",
  authenticate,
  asyncHandler(async (req, res) => {
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  }),
);

/**
 * @swagger
 * /api/auth/onboarding-step:
 *   patch:
 *     summary: Update onboarding step
 *     description: Updates the user's current onboarding step
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - step
 *             properties:
 *               step:
 *                 type: string
 *                 enum: [welcome, location, university, contacts, complete]
 *                 example: university
 *     responses:
 *       200:
 *         description: Onboarding step updated successfully
 *       400:
 *         description: Invalid step
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/onboarding-step",
  authenticate,
  validate([
    body("step")
      .notEmpty()
      .withMessage("Step is required")
      .isIn(["welcome", "location", "university", "contacts", "complete"])
      .withMessage("Invalid onboarding step"),
  ]),
  asyncHandler(async (req, res, next) => {
    try {
      const { step } = req.body;

      const user = await User.findByIdAndUpdate(
        req.userId,
        { onboardingStep: step },
        { new: true },
      ).select("-__v");

      res.status(200).json({
        success: true,
        message: "Onboarding step updated",
        step: user.onboardingStep,
      });
    } catch (error) {
      next(error);
    }
  }),
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     description: Returns the authenticated user's profile information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res, next) => {
    try {
      const user = await User.findById(req.userId).select("-__v");

      const contactCount = await TrustedContact.countDocuments({
        userId: req.userId,
        isActive: true,
      });

      res.status(200).json({
        success: true,
        user: {
          ...user.toJSON(),
          trustedContactsCount: contactCount,
          maxContacts: config.maxTrustedContacts,
        },
      });
    } catch (error) {
      next(error);
    }
  }),
);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset OTP
 *     description: Sends a password reset OTP to the user's email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student@campus.edu
 *     responses:
 *       200:
 *         description: Password reset OTP sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 development_otp:
 *                   type: string
 *       404:
 *         description: Email not found
 *       429:
 *         description: Too many requests
 */
router.post(
  "/forgot-password",
  otpLimiter,
  validate([
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please enter a valid email address")
      .normalizeEmail(),
  ]),
  asyncHandler(async (req, res, next) => {
    try {
      const { email } = req.body;

      // Check if user exists
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No account found with this email address.",
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "This account is deactivated. Please contact support.",
        });
      }

      // Check if user can reset password
      if (!user.canResetPassword()) {
        return res.status(429).json({
          success: false,
          message: "Too many password reset attempts. Please try again later.",
        });
      }

      // Invalidate any existing reset OTPs for this user
      await OTP.updateMany(
        {
          email: user.email,
          purpose: "reset_password",
          isUsed: false,
        },
        { isUsed: true },
      );

      // Send password reset OTP
      const result = await emailService.sendPasswordResetOTP(
        user.email,
        user.phoneNumber,
        user.name,
      );

      const response = {
        success: true,
        message: "Password reset OTP sent to your email.",
        resetId: result.resetId,
      };

      if (isDevelopment && result.development_otp) {
        response.development_otp = result.development_otp;
      }

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }),
);

/**
 * @swagger
 * /api/auth/verify-reset-otp:
 *   post:
 *     summary: Verify password reset OTP
 *     description: Verifies the OTP for password reset and returns a reset token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otpCode
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student@campus.edu
 *               otpCode:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 resetToken:
 *                   type: string
 *                 resetId:
 *                   type: string
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 *       429:
 *         description: Too many attempts
 */
router.post(
  "/verify-reset-otp",
  authLimiter,
  validate([
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
  ]),
  asyncHandler(async (req, res, next) => {
    try {
      const { email, otpCode } = req.body;

      // Verify OTP
      const result = await emailService.verifyPasswordResetOTP(email, otpCode);

      const resetToken = jwt.sign(
        {
          userId: result.user._id,
          email: result.user.email,
          purpose: "password_reset",
        },
        config.jwtSecret,
      );

      res.status(200).json({
        success: true,
        message: "OTP verified successfully. You can now reset your password.",
        resetToken,
        resetId: result.resetId,
        user: {
          id: result.user._id,
          email: result.user.email,
          name: result.user.name,
        },
      });
    } catch (error) {
      // Handle known errors gracefully
      if (error.message === "Invalid or expired OTP") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message === "User not found") {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }
      if (error.message === "OTP has expired") {
        return res.status(400).json({
          success: false,
          message: "OTP has expired. Please request a new one.",
        });
      }
      next(error);
    }
  }),
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password
 *     description: Resets the user's password using the reset token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resetToken
 *               - newPassword
 *             properties:
 *               resetToken:
 *                 type: string
 *                 description: Reset token from verify-reset-otp
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: New password (min 8 characters)
 *               confirmPassword:
 *                 type: string
 *                 description: Must match newPassword
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid reset token or passwords don't match
 *       401:
 *         description: Invalid or expired reset token
 */
router.post(
  "/reset-password",
  validate([
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
  ]),
  asyncHandler(async (req, res, next) => {
    try {
      const { resetToken, newPassword } = req.body;

      // Verify reset token
      let decoded;
      try {
        decoded = jwt.verify(resetToken, config.jwtSecret);
      } catch (error) {
        if (error.name === "TokenExpiredError") {
          return res.status(401).json({
            success: false,
            message: "Reset token has expired. Please request a new one.",
          });
        }
        return res.status(401).json({
          success: false,
          message: "Invalid reset token.",
        });
      }

      // Check if token is for password reset
      if (decoded.purpose !== "password_reset") {
        return res.status(401).json({
          success: false,
          message: "Invalid reset token.",
        });
      }

      // Find user
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Account is deactivated.",
        });
      }

      // Check if user can reset password
      if (!user.canResetPassword()) {
        return res.status(429).json({
          success: false,
          message: "Too many password reset attempts. Please try again later.",
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update user password
      user.password = hashedPassword;
      user.lastPasswordChange = new Date();
      user.passwordResetAt = new Date();
      await user.save();

      // Invalidate all reset OTPs for this user
      await OTP.updateMany(
        {
          email: user.email,
          purpose: "reset_password",
          isUsed: false,
        },
        { isUsed: true },
      );

      // Log the password reset
      console.log(`Password reset for user: ${user.email}`);

      res.status(200).json({
        success: true,
        message:
          "Password reset successfully. You can now login with your new password.",
      });
    } catch (error) {
      next(error);
    }
  }),
);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change password (authenticated)
 *     description: Allows authenticated users to change their password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: User's current password
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: New password (min 8 characters)
 *               confirmPassword:
 *                 type: string
 *                 description: Must match newPassword
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password or validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/change-password",
  authenticate,
  validate([
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
  ]),
  asyncHandler(async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Get user with password field
      const user = await User.findById(req.userId).select("+password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      // Check if user has a password set
      if (!user.password) {
        return res.status(400).json({
          success: false,
          message:
            "You don't have a password set. Please use the reset password feature.",
        });
      }

      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect.",
        });
      }

      // Check if user can change password
      if (!user.canResetPassword()) {
        return res.status(429).json({
          success: false,
          message: "Too many password change attempts. Please try again later.",
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update user password
      user.password = hashedPassword;
      user.lastPasswordChange = new Date();
      await user.save();

      console.log(`Password changed for user: ${user.email}`);

      res.status(200).json({
        success: true,
        message: "Password changed successfully.",
      });
    } catch (error) {
      next(error);
    }
  }),
);

export default router;
