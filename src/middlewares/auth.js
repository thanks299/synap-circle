import User from "../models/User.js";
import { logger } from "../utils/logger.js";
import {
  verifyAccessToken,
  getAccessTokenFromCookie,
} from "../utils/tokenService.js";

/**
 * cookies Authorization
 */
const extractToken = (req) => {
  const cookieToken = getAccessTokenFromCookie(req);
  if (cookieToken) return cookieToken;

  const authHeader = req.header("Authorization");
  return authHeader?.replace("Bearer ", "") || null;
};

/**
 * Decode a token and load its associated (active) user.
 * Returns { user } on success, or { errorStatus, errorBody } on failure.
 */
const resolveUserFromToken = async (token) => {
  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return {
      errorStatus: 401,
      errorBody: {
        success: false,
        message: "Invalid token. Please log in again.",
        code: "INVALID_TOKEN",
      },
    };
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    // Return a special status for user not found - let the route handler decide
    return {
      errorStatus: 404,
      errorBody: {
        success: false,
        message: "User not found. Please log in again.",
        code: "USER_NOT_FOUND",
      },
      // Signal that this is a user-not-found case, not an auth failure
      userNotFound: true,
    };
  }

  if (!user.isActive) {
    return {
      errorStatus: 403,
      errorBody: {
        success: false,
        message: "Account is deactivated. Please contact support.",
        code: "ACCOUNT_DEACTIVATED",
      },
    };
  }

  return { user };
};

/**
 * Map a thrown error to the appropriate auth error response.
 */
const mapAuthError = (error) => {
  if (error.name === "JsonWebTokenError") {
    return {
      status: 401,
      body: {
        success: false,
        message: "Invalid token. Please log in again.",
        code: "INVALID_TOKEN",
      },
    };
  }

  if (error.name === "TokenExpiredError") {
    return {
      status: 401,
      body: {
        success: false,
        message: "Token expired. Please refresh or log in again.",
        code: "TOKEN_EXPIRED",
      },
    };
  }

  logger.error("Auth middleware error:", error);
  return {
    status: 500,
    body: {
      success: false,
      message: "Authentication error. Please try again.",
      code: "AUTH_ERROR",
    },
  };
};

/**
 * Authentication middleware - verify JWT access token from cookie
 * (or Authorization header) and attach the user to the request.
 */
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
        code: "MISSING_TOKEN",
      });
    }

    const result = await resolveUserFromToken(token);

    // If user not found, we want the route handler to handle it (for 404 tests)
    if (result.userNotFound) {
      req._userNotFound = true;
      req.userId = null;
      req.user = null;
      return next();
    }

    if (!result.user) {
      return res.status(result.errorStatus).json(result.errorBody);
    }

    req.user = result.user;
    req.userId = result.user._id;

    next();
  } catch (error) {
    const { status, body } = mapAuthError(error);
    return res.status(status).json(body);
  }
};

/**
 * Role-based authorization middleware
 * Only allow specific roles to access certain endpoints
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions. Access denied.",
      });
    }

    next();
  };
};

/**
 * Check if user has a specific permission
 * For more granular authorization
 */
const hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!req.user.permissions?.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Required: ${permission}`,
      });
    }

    next();
  };
};

/**
 * Verify that the user is accessing their own resource
 * For endpoints like /users/:id
 */
const isOwnResource = (paramName = "id") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const resourceId = req.params[paramName];
    if (!resourceId) {
      return res.status(400).json({
        success: false,
        message: "Resource ID is required",
      });
    }

    // Check if the user is accessing their own resource
    if (resourceId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only access your own resources.",
      });
    }

    next();
  };
};

export { authenticate, authorize, hasPermission, isOwnResource };
