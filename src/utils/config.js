/**
 * Central place to read and validate environment configuration.
 *
 * Previously process.env.JWT_SECRET, MAX_TRUSTED_CONTACTS,
 * CANCELLATION_WINDOW_MINUTES, etc. were read inline across many files
 * with no validation, so a missing JWT_SECRET only surfaced as a
 * confusing error deep inside jsonwebtoken the first time someone logged
 * in. This fails fast at startup instead, and gives every other module a
 * single, typed source for config values.
 *
 * NOTE: This must not import ./logger.js — logger.js reads config values
 * from here, so importing it back would create a circular dependency.
 */

const required = ["JWT_SECRET"];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(", ")}. The app cannot start without them.`,
  );
}

const nodeEnv = process.env.NODE_ENV || "development";

const config = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  isTest: nodeEnv === "test",
  isDevelopment: nodeEnv !== "production",

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRE || "7d",

  disableEmailSending: process.env.DISABLE_EMAIL_SENDING === "true",
  disableRateLimiting: process.env.DISABLE_RATE_LIMITING === "true",

  maxTrustedContacts: Number.parseInt(process.env.MAX_TRUSTED_CONTACTS) || 3,
  cancellationWindowMinutes:
    Number.parseInt(process.env.CANCELLATION_WINDOW_MINUTES) || 5,
  sosTimeoutSeconds: Number.parseInt(process.env.SOS_TIMEOUT_SECONDS) || 5,
  otpExpiryMinutes: 10,

  brevo: {
    apiKey: process.env.BREVO_API_KEY,
    fromName: process.env.BREVO_FROM_NAME || "SafeWalk Campus",
    fromEmail: process.env.BREVO_FROM_EMAIL,
  },
};

export default config;
