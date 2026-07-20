// src/routes/auth.js - COMPLETE FIXED VERSION

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
import {
  generateAccessToken,
  generateRefreshToken,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearTokenCookies,
  generateCsrfToken,
  verifyCsrfToken,
  getRefreshTokenFromCookie,
  verifyRefreshToken,
} from "../utils/tokenService.js";
import { logger } from "../utils/logger.js";
import mongoose from "mongoose";
import { OAuth2Client } from "google-auth-library";

const router = express.Router();

const googleClient = new OAuth2Client(config.googleClientId);

// Helper: Verify a Google ID token and return its payload
const verifyGoogleIdToken = async (idToken) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: config.googleClientId,
  });
  return ticket.getPayload();
};

// Helper: Find an existing user for this Google account, or create one
const resolveGoogleUser = async (payload) => {
  const { sub: googleId, email, name, picture, email_verified } = payload;

  let user = await User.findOne({ googleId });
  if (user) {
    return { user, isNewUser: false };
  }

  // Link to an existing local account with the same email, if any
  user = await User.findOne({ email });
  if (user) {
    user.googleId = googleId;
    if (!user.profilePicture) user.profilePicture = picture;
    if (user.authProvider === "local" && !user.password) {
      user.authProvider = "google";
    }
    if (email_verified) user.isVerified = user.isVerified || true;
    await user.save();
    return { user, isNewUser: false };
  }

  user = await User.create({
    googleId,
    email,
    name: name || "",
    profilePicture: picture,
    authProvider: "google",
    isVerified: !!email_verified,
  });
  return { user, isNewUser: true };
};

const STEP_ORDER = [
  "welcome",
  "location",
  "university",
  "contacts",
  "complete",
];

// Helper: Validate step existence
const validateStep = (step) => {
  if (!STEP_ORDER.includes(step)) {
    throw new Error("Invalid onboarding step");
  }
};

// Helper: Check if forward navigation is allowed
const canNavigateForward = (currentIndex, targetIndex) => {
  return targetIndex <= currentIndex + 1 || currentIndex === -1;
};

// Helper: Build navigation response
const buildNavigationResponse = (targetIndex, isComplete) => {
  const canGoBack = targetIndex > 0;
  const canGoForward = targetIndex < STEP_ORDER.length - 1 && !isComplete;
  const previousStep = targetIndex > 0 ? STEP_ORDER[targetIndex - 1] : null;
  const nextStep =
    targetIndex < STEP_ORDER.length - 1 ? STEP_ORDER[targetIndex + 1] : null;

  return { canGoBack, canGoForward, previousStep, nextStep };
};

// Helper Process university data - FIXED to handle missing University model
const processUniversityData = async (data, userId) => {
  const updateData = {};

  if (!data.universityId) {
    if (data.selectedUniversity) {
      updateData.selectedUniversity = data.selectedUniversity;
    }
    return updateData;
  }

  let University;
  try {
    University = mongoose.model("University");
  } catch (e) {
    if (data.universityId) {
      updateData.universityId = data.universityId;
    }
    if (data.selectedUniversity) {
      updateData.selectedUniversity = data.selectedUniversity;
    }
    return updateData;
  }

  try {
    const university = await University.findById(data.universityId);
    if (university) {
      updateData.universityId = data.universityId;
      updateData.selectedUniversity = university.name;
    } else if (data.selectedUniversity) {
      updateData.selectedUniversity = data.selectedUniversity;
    }
  } catch (error) {
    // This is a recoverable error - we have fallback data
    logger.error(
      `Failed to resolve university ${data.universityId} for user ${userId}:`,
      error,
    );
    if (data.selectedUniversity) {
      updateData.selectedUniversity = data.selectedUniversity;
    }
  }

  return updateData;
};

// Helper: Process location data - FIXED to properly save location
const processLocationData = (user, data) => {
  if (data.location?.latitude && data.location?.longitude) {
    if (!user.preferences) user.preferences = {};
    user.preferences.onboardingLocation = {
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      updatedAt: new Date(),
    };
    return true;
  }
  return false;
};

// Helper Validate completion prerequisites
const validateCompletionPrerequisites = async (userId, targetIndex) => {
  const contactsIndex = STEP_ORDER.indexOf("contacts");

  if (targetIndex >= contactsIndex) {
    const contactCount = await TrustedContact.countDocuments({
      userId: userId,
      isActive: true,
    });

    if (contactCount === 0) {
      return {
        isValid: false,
        message:
          "Please add at least one trusted contact before completing onboarding",
        requiredStep: "contacts",
        contactCount: 0,
      };
    }
  }

  return { isValid: true };
};

// Helper: Handle onboarding completion
const handleOnboardingComplete = async (user) => {
  if (!user.isVerified) {
    user.isVerified = true;
    user.lastLogin = new Date();
    await user.save();

    logger.info(`User ${user._id} completed onboarding and is now verified`);

    if (emailService.sendOnboardingCompleteEmail) {
      Promise.resolve(emailService.sendOnboardingCompleteEmail(user)).catch(
        (err) => {
          logger.error("Onboarding completion email failed:", err);
        },
      );
    }
  }
};

const buildUserResponse = (user) => {
  const response = {
    id: user._id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    isVerified: user.isVerified,
    onboardingStep: user.onboardingStep,
    authProvider: user.authProvider,
    profilePicture: user.profilePicture,
  };

  if (user.selectedUniversity) {
    response.selectedUniversity = user.selectedUniversity;
  }
  if (user.universityId) {
    response.universityId = user.universityId;
  }

  return response;
};

const resolveStepNavigation = (user, step) => {
  const currentIndex = STEP_ORDER.indexOf(user.onboardingStep);
  const targetIndex = STEP_ORDER.indexOf(step);

  // Allow jumping to complete from any step (will be validated by checkCompletionPrerequisites)
  if (step === "complete") {
    return { ok: true, currentIndex, targetIndex };
  }

  // Allow going backward freely
  if (targetIndex < currentIndex) {
    return { ok: true, currentIndex, targetIndex };
  }

  // Only allow forward movement one step at a time
  if (targetIndex > currentIndex + 1) {
    const nextStep = STEP_ORDER[currentIndex + 1] || "complete";
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        message: `Please complete steps in order. Next step: ${nextStep}`,
        currentStep: user.onboardingStep,
        nextStep: nextStep,
      },
    };
  }

  return { ok: true, currentIndex, targetIndex };
};

// Helper: Log warnings for missing optional data ahead of completion
const logMissingOptionalData = (user, userId) => {
  const hasLocationData = user.preferences?.onboardingLocation;
  const hasUniversityData = user.universityId || user.selectedUniversity;

  if (!hasLocationData && user.onboardingStep !== "complete") {
    logger.info(`User ${userId} completing onboarding without location data`);
  }
  if (!hasUniversityData && user.onboardingStep !== "complete") {
    logger.info(`User ${userId} completing onboarding without university data`);
  }
};

const checkCompletionPrerequisites = async (
  user,
  userId,
  step,
  targetIndex,
) => {
  if (step !== "complete" || targetIndex <= 0) {
    return { ok: true };
  }

  const validation = await validateCompletionPrerequisites(userId, targetIndex);
  if (!validation.isValid) {
    return {
      ok: false,
      status: 400,
      body: { success: false, ...validation },
    };
  }

  logMissingOptionalData(user, userId);
  return { ok: true };
};

// Helper: Build step update data
const buildStepUpdateData = async (step, data, user, userId) => {
  const updateData = {};

  // Always update the onboarding step
  updateData.onboardingStep = step;

  if (step === "university") {
    const universityData = await processUniversityData(data, userId);
    Object.assign(updateData, universityData);
  }

  if (
    step === "location" &&
    data.location?.latitude &&
    data.location?.longitude
  ) {
    const currentPreferences = user.preferences || {};

    // Update the entire preferences object with the new location data
    updateData.preferences = {
      ...currentPreferences,
      onboardingLocation: {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        updatedAt: new Date(),
      },
    };
  }

  return updateData;
};

// Helper: Fetch contact count/limit summary if the step requires it
const getContactSummary = async (userId, targetIndex, contactsIndex) => {
  if (targetIndex < contactsIndex) {
    return null;
  }

  const count = await TrustedContact.countDocuments({
    userId: userId,
    isActive: true,
  });

  return { count, maxContacts: config.maxTrustedContacts };
};

// ---------- CSRF Token Endpoint ----------
router.get("/csrf-token", (req, res) => {
  const token = generateCsrfToken(res);
  res.json({ csrfToken: token });
});

// Helper: Validate signup input (email/password presence and password strength)
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

const validateSignupInput = (email, password) => {
  if (!email) {
    return {
      status: 400,
      body: {
        success: false,
        message: "Email is required for OTP verification.",
      },
    };
  }

  if (!password) {
    return {
      status: 400,
      body: { success: false, message: "Password is required." },
    };
  }

  if (!PASSWORD_PATTERN.test(password)) {
    return {
      status: 400,
      body: {
        success: false,
        message:
          "Password must be at least 8 characters long and contain at least one letter and one number.",
      },
    };
  }

  return null;
};

/**
 * Helper: Resolve whether this signup conflicts with an existing account, or if it can resume an incomplete signup.
 * Returns either a conflict response or the existing user (if any).
 */
const resolveSignupAccount = async (email, phoneNumber) => {
  const existingByEmail = await User.findOne({ email });
  const existingByPhone = await User.findOne({ phoneNumber });

  /**
   * Only treat this as "resuming" an incomplete signup if the email and
   * phone number both belong to the SAME existing account. Otherwise, one
   * of them belongs to a different account and is a genuine conflict.
   */
  const isSameAccount =
    existingByEmail &&
    existingByPhone &&
    existingByEmail._id.equals(existingByPhone._id);

  if (!isSameAccount) {
    if (existingByEmail) {
      return {
        conflict: {
          status: 400,
          body: {
            success: false,
            message: "Email already registered. Please use a different email.",
          },
        },
      };
    }
    if (existingByPhone) {
      return {
        conflict: {
          status: 400,
          body: {
            success: false,
            message: "Phone number already registered. Please log in.",
          },
        },
      };
    }
    return { user: null };
  }

  if (existingByEmail.isVerified) {
    return {
      conflict: {
        status: 400,
        body: {
          success: false,
          message: "Account already exists. Please log in.",
        },
      },
    };
  }

  return { user: existingByEmail };
};

/**
 * Helper: Create a new user, or update an existing unverified one to resume
 * an incomplete signup.
 */
const upsertSignupUser = async (
  existingUser,
  { email, phoneNumber, name, password },
) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  if (existingUser) {
    existingUser.name = name || existingUser.name;
    existingUser.email = email || existingUser.email;
    existingUser.phoneNumber = phoneNumber || existingUser.phoneNumber;
    existingUser.password = hashedPassword;
    existingUser.lastPasswordChange = new Date();
    await existingUser.save();
    return { user: existingUser, isNewUser: false };
  }

  const user = await User.create({
    email,
    phoneNumber,
    name: name || "",
    password: hashedPassword,
    isVerified: false,
  });
  return { user, isNewUser: true };
};

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

      const inputError = validateSignupInput(email, password);
      if (inputError) {
        return res.status(inputError.status).json(inputError.body);
      }

      const accountResult = await resolveSignupAccount(email, phoneNumber);
      if (accountResult.conflict) {
        return res
          .status(accountResult.conflict.status)
          .json(accountResult.conflict.body);
      }

      const { user, isNewUser } = await upsertSignupUser(accountResult.user, {
        email,
        phoneNumber,
        name,
        password,
      });

      // Send OTP via email
      const result = await emailService.sendOTP(email, phoneNumber, "signup");

      if (isNewUser) {
        Promise.resolve(emailService.sendWelcomeEmail(user)).catch((err) => {
          logger.error("Welcome email sending failed:", err);
        });
      }

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
 *     description: Authenticates a user with email and password, sets HTTP-only cookies
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
 *         headers:
 *           Set-Cookie:
 *             description: accessToken and refreshToken HTTP-only cookies
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
  verifyCsrfToken,
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
            "No password set for this account yet. Please use forgot-password.",
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password.",
        });
      }

      // Generate tokens
      const accessToken = generateAccessToken(user._id, user.email);
      const refreshToken = generateRefreshToken(user._id, user.email);

      // Set cookies
      setAccessTokenCookie(res, accessToken);
      setRefreshTokenCookie(res, refreshToken);

      // Generate CSRF token
      const csrfToken = generateCsrfToken(res);

      user.lastLogin = new Date();
      await user.save();

      logger.info("Login successful", {
        userId: user._id,
        email: user.email,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: "Login successful",
        token: accessToken,
        refreshToken,
        csrfToken,
        user: {
          id: user._id,
          phoneNumber: user.phoneNumber,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          onboardingStep: user.onboardingStep,
        },
      });
    } catch (error) {
      next(error);
    }
  }),
);

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Sign in or sign up with Google
 *     description: Verifies a Google ID token (obtained client-side via Google Sign-In) and issues HTTP-only session cookies. Creates a new account on first sign-in, or links Google to an existing account with the same email.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: The ID token returned by Google Sign-In on the client
 *     responses:
 *       200:
 *         description: Signed in successfully
 *         headers:
 *           Set-Cookie:
 *             description: accessToken and refreshToken HTTP-only cookies
 *       400:
 *         description: Missing or invalid ID token
 *       401:
 *         description: Google token verification failed
 *       403:
 *         description: Account is deactivated
 */
router.post(
  "/google",
  verifyCsrfToken,
  authLimiter,
  validate([
    body("idToken").notEmpty().withMessage("Google ID token is required"),
  ]),
  asyncHandler(async (req, res, next) => {
    try {
      const { idToken } = req.body;

      let payload;
      try {
        payload = await verifyGoogleIdToken(idToken);
      } catch (error) {
        logger.error("Google ID token verification failed:", error);
        return res.status(401).json({
          success: false,
          message: "Invalid or expired Google token.",
        });
      }

      if (!payload?.email) {
        return res.status(401).json({
          success: false,
          message: "Google account did not return an email address.",
        });
      }

      const { user, isNewUser } = await resolveGoogleUser(payload);

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Account is deactivated. Please contact support.",
        });
      }

      if (isNewUser) {
        Promise.resolve(emailService.sendWelcomeEmail(user)).catch((err) => {
          logger.error("Welcome email sending failed:", err);
        });
      }

      // Generate tokens (same session mechanism as password login)
      const accessToken = generateAccessToken(user._id, user.email);
      const refreshToken = generateRefreshToken(user._id, user.email);

      setAccessTokenCookie(res, accessToken);
      setRefreshTokenCookie(res, refreshToken);

      const csrfToken = generateCsrfToken(res);

      user.lastLogin = new Date();
      await user.save();

      logger.info("Google sign-in successful", {
        userId: user._id,
        email: user.email,
        isNewUser,
      });

      res.status(200).json({
        success: true,
        message: isNewUser ? "Account created with Google" : "Login successful",
        isNewUser,
        token: accessToken,
        refreshToken,
        csrfToken,
        user: buildUserResponse(user),
      });
    } catch (error) {
      next(error);
    }
  }),
);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     description: Uses refresh token cookie to generate new access and refresh tokens
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *         headers:
 *           Set-Cookie:
 *             description: New accessToken and refreshToken HTTP-only cookies
 *       401:
 *         description: Invalid or missing refresh token
 */
router.post(
  "/refresh-token",
  verifyCsrfToken,
  asyncHandler(async (req, res, next) => {
    try {
      const refreshToken = getRefreshTokenFromCookie(req);

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Refresh token required. Please log in.",
        });
      }

      const decoded = verifyRefreshToken(refreshToken);

      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired refresh token. Please log in again.",
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

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Account is deactivated.",
        });
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken(user._id, user.email);
      const newRefreshToken = generateRefreshToken(user._id, user.email);

      // Set new cookies
      setAccessTokenCookie(res, newAccessToken);
      setRefreshTokenCookie(res, newRefreshToken);

      // Generate new CSRF token
      const csrfToken = generateCsrfToken(res);

      logger.info("Tokens refreshed", {
        userId: user._id,
        email: user.email,
      });

      res.status(200).json({
        success: true,
        message: "Tokens refreshed successfully",
        csrfToken,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          phoneNumber: user.phoneNumber,
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
 *     description: Verifies the OTP sent to email and sets auth cookies
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
 *               otpCode:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         headers:
 *           Set-Cookie:
 *             description: accessToken and refreshToken HTTP-only cookies
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 */
router.post(
  "/verify-otp",
  verifyCsrfToken,
  authLimiter,
  validate(authValidation.verifyOTP),
  asyncHandler(async (req, res, next) => {
    try {
      const { email, otpCode } = req.body;

      // Verify OTP using email
      const result = await emailService.verifyOTP(email, otpCode);

      // Generate tokens
      const accessToken = generateAccessToken(
        result.user._id,
        result.user.email,
      );
      const refreshToken = generateRefreshToken(
        result.user._id,
        result.user.email,
      );

      // Set cookies
      setAccessTokenCookie(res, accessToken);
      setRefreshTokenCookie(res, refreshToken);

      // Generate CSRF token
      const csrfToken = generateCsrfToken(res);

      // Update last login
      result.user.lastLogin = new Date();
      await result.user.save();

      res.status(200).json({
        success: true,
        message: "OTP verified successfully",
        token: accessToken,
        refreshToken,
        csrfToken,
        user: {
          id: result.user._id,
          phoneNumber: result.user.phoneNumber,
          name: result.user.name,
          email: result.user.email,
          isVerified: result.user.isVerified,
          onboardingStep: result.user.onboardingStep,
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
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       404:
 *         description: Email not found
 *       429:
 *         description: Too many requests
 */
router.post(
  "/resend-otp",
  verifyCsrfToken,
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

      // Invalidate old OTPs
      await OTP.updateMany({ email, isUsed: false }, { isUsed: true });

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
 *     description: Clears authentication cookies and logs out the user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post(
  "/logout",
  verifyCsrfToken,
  authenticate,
  asyncHandler(async (req, res) => {
    // Clear all auth cookies
    clearTokenCookies(res);

    logger.info("User logged out", {
      userId: req.userId,
      email: req.user?.email,
    });

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
 *               data:
 *                 type: object
 *                 properties:
 *                   universityId:
 *                     type: string
 *                   selectedUniversity:
 *                     type: string
 *                   location:
 *                     type: object
 *                     properties:
 *                       latitude:
 *                         type: number
 *                       longitude:
 *                         type: number
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
  verifyCsrfToken,
  authenticate,
  validate([
    body("step")
      .notEmpty()
      .withMessage("Step is required")
      .isIn(STEP_ORDER)
      .withMessage("Invalid onboarding step"),
    body("data")
      .optional()
      .isObject()
      .withMessage("Data must be an object if provided"),
  ]),
  asyncHandler(async (req, res, next) => {
    try {
      const { step, data = {} } = req.body;
      const userId = req.userId;

      // Check if user was not found by auth middleware
      if (req._userNotFound) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      try {
        validateStep(step);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      const navResult = resolveStepNavigation(user, step);
      if (!navResult.ok) {
        return res.status(navResult.status).json(navResult.body);
      }
      const { targetIndex } = navResult;

      const completionCheck = await checkCompletionPrerequisites(
        user,
        userId,
        step,
        targetIndex,
      );
      if (!completionCheck.ok) {
        return res.status(completionCheck.status).json(completionCheck.body);
      }

      const updateData = await buildStepUpdateData(step, data, user, userId);

      // Use $set for all updates - this handles dot notation properly
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true },
      ).select("-__v");

      const isComplete = step === "complete";
      if (isComplete) {
        await handleOnboardingComplete(updatedUser);
      }

      const progress = Math.round(
        ((targetIndex + 1) / STEP_ORDER.length) * 100,
      );
      const navigation = buildNavigationResponse(targetIndex, isComplete);

      const contactsIndex = STEP_ORDER.indexOf("contacts");
      const contactSummary = await getContactSummary(
        userId,
        targetIndex,
        contactsIndex,
      );

      logger.info(
        `Onboarding navigation for user ${userId}: ${user.onboardingStep} → ${step} (${progress}%)`,
      );

      const response = {
        success: true,
        message: `Onboarding step updated to: ${step}`,
        step: updatedUser.onboardingStep,
        isComplete,
        progress,
        ...navigation,
        user: buildUserResponse(updatedUser),
      };

      if (contactSummary) {
        response.contacts = contactSummary;
      }

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }),
);
/**
 * @swagger
 * /api/auth/onboarding-status:
 *   get:
 *     summary: Get onboarding status
 *     description: Returns the current onboarding status and available steps
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding status retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/onboarding-status",
  authenticate,
  asyncHandler(async (req, res, next) => {
    try {
      const userId = req.userId;

      // Check if user was not found by auth middleware
      if (req._userNotFound) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const currentIndex = STEP_ORDER.indexOf(user.onboardingStep);
      const isComplete = user.onboardingStep === "complete";

      const stepLabels = {
        welcome: "Welcome & Profile",
        location: "Location Settings",
        university: "University Selection",
        contacts: "Add Contacts",
        complete: "Complete",
      };

      // FIXED: When isComplete is true, ALL steps should be marked as completed
      const steps = STEP_ORDER.map((step, index) => {
        // If onboarding is complete, all steps are completed
        if (isComplete) {
          return {
            step,
            label: stepLabels[step] || step,
            isCompleted: true,
            isActive: false,
            isLocked: false,
          };
        }

        let status = "upcoming";
        if (index < currentIndex) status = "completed";
        if (index === currentIndex) status = "active";

        return {
          step,
          label: stepLabels[step] || step,
          isCompleted: status === "completed",
          isActive: status === "active",
          isLocked: status === "upcoming" && !isComplete,
        };
      });

      const contactCount = await TrustedContact.countDocuments({
        userId: userId,
        isActive: true,
      });

      const progress = isComplete
        ? 100
        : Math.round(((currentIndex + 1) / STEP_ORDER.length) * 100);
      const canGoForward = !isComplete && currentIndex < STEP_ORDER.length - 1;
      const canGoBack = currentIndex > 0;

      res.status(200).json({
        success: true,
        currentStep: user.onboardingStep,
        progress,
        isComplete,
        steps,
        canGoForward,
        canGoBack,
        nextStep: canGoForward ? STEP_ORDER[currentIndex + 1] : null,
        previousStep: canGoBack ? STEP_ORDER[currentIndex - 1] : null,
        contactsCount: contactCount,
        maxContacts: config.maxTrustedContacts,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          isVerified: user.isVerified,
          ...(user.selectedUniversity && {
            selectedUniversity: user.selectedUniversity,
          }),
        },
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
 *     responses:
 *       200:
 *         description: Password reset OTP sent
 *       404:
 *         description: Email not found
 *       429:
 *         description: Too many requests
 */
router.post(
  "/forgot-password",
  verifyCsrfToken,
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

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No account found with this email address.",
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "This account is deactivated. Please contact support.",
        });
      }

      if (!user.canResetPassword()) {
        return res.status(429).json({
          success: false,
          message: "Too many password reset attempts. Please try again later.",
        });
      }

      // Invalidate any existing reset OTPs
      await OTP.updateMany(
        {
          email: user.email,
          purpose: "reset_password",
          isUsed: false,
        },
        { isUsed: true },
      );

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
 *               otpCode:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 *       429:
 *         description: Too many attempts
 */
router.post(
  "/verify-reset-otp",
  verifyCsrfToken,
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

      const result = await emailService.verifyPasswordResetOTP(email, otpCode);

      const resetToken = jwt.sign(
        {
          userId: result.user._id,
          email: result.user.email,
          purpose: "password_reset",
        },
        config.jwtSecret,
        { expiresIn: "30m" },
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
 *               - confirmPassword
 *             properties:
 *               resetToken:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid reset token or passwords don't match
 *       401:
 *         description: Invalid or expired reset token
 */
router.post(
  "/reset-password",
  verifyCsrfToken,
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

      if (decoded.purpose !== "password_reset") {
        return res.status(401).json({
          success: false,
          message: "Invalid reset token.",
        });
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Account is deactivated.",
        });
      }

      if (!user.canResetPassword()) {
        return res.status(429).json({
          success: false,
          message: "Too many password reset attempts. Please try again later.",
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      user.lastPasswordChange = new Date();
      user.passwordResetAt = new Date();
      await user.save();

      await OTP.updateMany(
        {
          email: user.email,
          purpose: "reset_password",
          isUsed: false,
        },
        { isUsed: true },
      );

      logger.info(`Password reset for user: ${user.email}`);

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
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
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
  verifyCsrfToken,
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

      const user = await User.findById(req.userId).select("+password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      if (!user.password) {
        return res.status(400).json({
          success: false,
          message:
            "You don't have a password set. Please use the reset password feature.",
        });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect.",
        });
      }

      if (!user.canResetPassword()) {
        return res.status(429).json({
          success: false,
          message: "Too many password change attempts. Please try again later.",
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      user.lastPasswordChange = new Date();
      await user.save();

      // Clear all auth cookies - force re-login
      clearTokenCookies(res);

      logger.info(`Password changed for user: ${user.email}`);

      res.status(200).json({
        success: true,
        message: "Password changed successfully. Please login again.",
      });
    } catch (error) {
      next(error);
    }
  }),
);

export default router;
