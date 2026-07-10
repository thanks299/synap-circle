const constants = {
  // Contact relationship types
  CONTACT_RELATIONSHIPS: {
    PARENT: "parent",
    SIBLING: "sibling",
    FRIEND: "friend",
    ROOMMATE: "roommate",
    PARTNER: "partner",
    OTHER: "other",
  },

  // Alert status types
  ALERT_STATUS: {
    SENT: "sent",
    CANCELLED: "cancelled",
    FAILED: "failed",
    RESOLVED: "resolved",
  },

  // Emergency contact types
  EMERGENCY_TYPES: {
    SECURITY: "security",
    HOSPITAL: "hospital",
    POLICE: "police",
    AMBULANCE: "ambulance",
    FIRE: "fire",
  },

  // OTP purposes
  OTP_PURPOSES: {
    SIGNUP: "signup",
    LOGIN: "login",
    RESET: "reset",
  },

  // Alert recipient types
  RECIPIENT_TYPES: {
    TRUSTED_CONTACT: "trusted_contact",
    CAMPUS_SECURITY: "campus_security",
  },

  // Cancellation reasons
  CANCELLATION_REASONS: {
    FALSE_ALARM: "false_alarm",
    RESOLVED: "resolved",
    USER_ERROR: "user_error",
  },

  // Configuration
  MAX_TRUSTED_CONTACTS: Number.parseInt(process.env.MAX_TRUSTED_CONTACTS) || 3,
  CANCELLATION_WINDOW_MINUTES:
    Number.parseInt(process.env.CANCELLATION_WINDOW_MINUTES) || 5,
  OTP_EXPIRY_MINUTES: 10,
  SOS_TIMEOUT_SECONDS: Number.parseInt(process.env.SOS_TIMEOUT_SECONDS) || 5,

  // Messages
  MESSAGES: {
    OTP_SENT: "OTP sent successfully",
    OTP_VERIFIED: "OTP verified successfully",
    OTP_INVALID: "Invalid or expired OTP",
    CONTACT_ADDED: "Contact added successfully",
    CONTACT_UPDATED: "Contact updated successfully",
    CONTACT_DELETED: "Contact deleted successfully",
    CONTACT_LIMIT_REACHED: `Maximum trusted contacts reached (${Number.parseInt(process.env.MAX_TRUSTED_CONTACTS) || 3})`,
    SOS_TRIGGERED: "SOS alert triggered successfully",
    SOS_CANCELLED: "SOS alert cancelled successfully",
    SOS_CANNOT_CANCEL:
      "Alert cannot be cancelled. Cancellation window has passed.",
    NO_CONTACTS: "No contacts available. Please add trusted contacts first.",
    LOCATION_UNAVAILABLE: "Location could not be determined",
  },

  // HTTP Status codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER: 500,
  },
};

export default constants;
