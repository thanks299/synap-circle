import rateLimit from "express-rate-limit";
import config from "../utils/config.js";

const shouldSkip = () => config.disableRateLimiting;

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
});

// Stricter limiter for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
});

// SOS trigger limiter (prevent spam)
const sosLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: "Too many SOS triggers. Please wait before sending another alert.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.userId || req.ip;
  },
  skip: shouldSkip,
});

// Contact management limiter
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many contact operations, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
});

// OTP limiter
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: "Too many OTP requests. Please wait before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
});

export {
  apiLimiter,
  authLimiter,
  sosLimiter,
  contactLimiter,
  otpLimiter,
  globalLimiter,
};
