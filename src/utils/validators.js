import { PHONE_REGEX, EMAIL_REGEX } from "./regex.js";

/**
 * Phone number validation
 */
const isValidPhoneNumber = (phoneNumber) => {
  return PHONE_REGEX.test(phoneNumber);
};

/**
 * Email validation
 */
const isValidEmail = (email) => {
  return EMAIL_REGEX.test(email);
};

/**
 * Name validation
 */
const isValidName = (name) => {
  return name && name.trim().length > 0 && name.trim().length <= 100;
};

/**
 * Latitude validation
 */
const isValidLatitude = (lat) => {
  return typeof lat === "number" && lat >= -90 && lat <= 90;
};

/**
 * Longitude validation
 */
const isValidLongitude = (lng) => {
  return typeof lng === "number" && lng >= -180 && lng <= 180;
};

/**
 * OTP validation
 */
const isValidOTP = (otp) => {
  return /^\d{6}$/.test(otp);
};

/**
 * Relationship validation
 */
const isValidRelationship = (relationship) => {
  const validRelationships = [
    "parent",
    "sibling",
    "friend",
    "roommate",
    "partner",
    "other",
  ];
  return validRelationships.includes(relationship);
};

/**
 * Sanitize phone number (remove spaces, hyphens, parentheses, and other
 * common separators)
 */
const sanitizePhoneNumber = (phoneNumber) => {
  return phoneNumber.replaceAll(/[\s\-()]/g, "");
};

/**
 * Truncate string to max length
 */
const truncateString = (str, maxLength) => {
  if (!str) return "";
  return str.length > maxLength ? str.substring(0, maxLength) + "..." : str;
};

/**
 * Validate and sanitize email (remove extra whitespace, convert to lowercase)
 */
const sanitizeEmail = (email) => {
  if (!email) return "";
  return email.trim().toLowerCase();
};

/**
 * Validate if a string is empty or only whitespace
 */
const isEmpty = (str) => {
  return !str || str.trim().length === 0;
};

/**
 * Validate URL
 */
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate if a value is a valid ID (MongoDB ObjectId format)
 */
const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Sanitize input string to prevent XSS
 * Removes any HTML tags from the input
 */
const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;
  return input.replace(/<[^>]*>/g, "").trim();
};

/**
 * Validate password strength
 * At least 8 characters, 1 uppercase, 1 lowercase, 1 number
 */
const isStrongPassword = (password) => {
  if (!password || password.length < 8) return false;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasUpperCase && hasLowerCase && hasNumber;
};

/**
 * Validate if a string contains only letters and spaces
 */
const isAlphaSpace = (str) => {
  return /^[a-zA-Z\s]+$/.test(str);
};

/**
 * Validate if a string contains only alphanumeric characters
 */
const isAlphanumeric = (str) => {
  return /^[a-zA-Z\d]+$/.test(str);
};

/**
 * Validate if a string contains only digits
 */
const isNumeric = (str) => {
  return /^\d+$/.test(str);
};

/**
 * Validate if a string contains only letters
 */
const isAlpha = (str) => {
  return /^[a-zA-Z]+$/.test(str);
};

/**
 * Validate if a string is a valid UUID
 */
const isValidUUID = (uuid) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    uuid,
  );
};

/**
 * Validate if a string contains a valid date in YYYY-MM-DD format
 */
const isValidDate = (date) => {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(date).getTime())
  );
};

/**
 * Validate if a string contains a valid time in HH:MM format (24-hour)
 */
const isValidTime = (time) => {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
};

const validators = {
  isValidPhoneNumber,
  isValidEmail,
  isValidName,
  isValidLatitude,
  isValidLongitude,
  isValidOTP,
  isValidRelationship,
  sanitizePhoneNumber,
  sanitizeEmail,
  sanitizeInput,
  isEmpty,
  isValidUrl,
  isValidObjectId,
  isStrongPassword,
  isAlphaSpace,
  isAlphanumeric,
  isNumeric,
  isAlpha,
  isValidUUID,
  isValidDate,
  isValidTime,
  truncateString,
};

export {
  isValidPhoneNumber,
  isValidEmail,
  isValidName,
  isValidLatitude,
  isValidLongitude,
  isValidOTP,
  isValidRelationship,
  sanitizePhoneNumber,
  sanitizeEmail,
  sanitizeInput,
  isEmpty,
  isValidUrl,
  isValidObjectId,
  isStrongPassword,
  isAlphaSpace,
  isAlphanumeric,
  isNumeric,
  isAlpha,
  isValidUUID,
  isValidDate,
  isValidTime,
  truncateString,
};

export default validators;
