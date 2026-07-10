import rateLimit from "express-rate-limit";

// All limiters are skipped when DISABLE_RATE_LIMITING is set, rather than
// whenever NODE_ENV === "test". This lets individual tests (e.g. the
// "too many SOS triggers" 429 test) temporarily flip rate limiting back on
// for just that test, while every other test keeps it off by default via
// setup.js setting process.env.DISABLE_RATE_LIMITING = "true".
const shouldSkip = () => process.env.DISABLE_RATE_LIMITING === "true";

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
