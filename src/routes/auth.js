import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import TrustedContact from "../models/TrustedContact.js";
import emailService from "../services/emailService.js";
import { validate, authValidation } from "../middlewares/validator.js";
import { authenticate } from "../middlewares/auth.js";
import { otpLimiter, authLimiter } from "../middlewares/rateLimiter.js";

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
  async (req, res, next) => {
    try {
      const { email, phoneNumber, name } = req.body;

      // Validate email is provided
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required for OTP verification.",
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

      if (user && !user.isVerified) {
        user.name = name || user.name;
        user.email = email || user.email;
        user.phoneNumber = phoneNumber || user.phoneNumber;
        await user.save();
      } else if (!user) {
        await User.create({
          email,
          phoneNumber,
          name: name || "",
          isVerified: false,
        });
      }

      // Send OTP via email
      const result = await emailService.sendOTP(email, phoneNumber, "signup");
      const isDevelopment = process.env.NODE_ENV !== "production";
      const response = {
        success: true,
        message: result.message || "OTP sent successfully to your email",
      };

      if (isDevelopment && result.development_otp) {
        response.development_otp = result.development_otp;
      }

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
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
  async (req, res, next) => {
    try {
      const { email, otpCode } = req.body;

      // Verify OTP using email
      const result = await emailService.verifyOTP(email, otpCode);

      // Generate JWT token
      const token = jwt.sign(
        { userId: result.user._id, email: result.user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || "7d" },
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
  },
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
  async (req, res, next) => {
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
      const isDevelopment = process.env.NODE_ENV !== "production";

      const response = {
        success: true,
        message: "OTP resent successfully to your email",
      };

      if (isDevelopment && result.development_otp) {
        response.development_otp = result.development_otp;
      }

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
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
router.post("/logout", authenticate, async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

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
router.get("/me", authenticate, async (req, res, next) => {
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
        maxContacts: Number.parseInt(process.env.MAX_TRUSTED_CONTACTS) || 3,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
