const prisma = require("../config/prisma");
const { verifyAccessToken, verifyRefreshToken, generateTokens } = require("../utils/jwt");

// Helper to get token from either cookie or header
const getTokenFromRequest = (req) => {
  // First check if it's an admin trying to access admin route
  // Check cookie for admin token (using camelCase)
  if (req.cookies && req.cookies.adminAccessToken) {
    return req.cookies.adminAccessToken;
  }
  
  // Fallback to Bearer token (for customers)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  
  return null;
};

// Get admin token specifically from cookie
const getAdminTokenFromCookie = (req) => {
  return req.cookies?.adminAccessToken || null;
};

// Get customer token from header
const getCustomerTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return null;
};

// Main auth middleware - tries both methods
const authMiddleware = async (req, res, next) => {
  try {
    // Try to get token from either cookie or header
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        code: "TOKEN_MISSING",
        message: "Authentication token is required",
      });
    }

    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isVerified: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: "USER_INACTIVE",
        message: "User account is inactive",
      });
    }

    req.user = user;
    req.authMethod = req.cookies?.adminAccessToken ? 'cookie' : 'bearer';

    next();
  } catch (error) {
    const isExpired = error.name === "TokenExpiredError";

    return res.status(401).json({
      success: false,
      code: isExpired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      message: isExpired ? "Token expired" : "Invalid token",
    });
  }
};

// Admin-specific middleware - only checks cookies
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = getAdminTokenFromCookie(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        code: "TOKEN_MISSING",
        message: "Admin authentication required. Please login.",
      });
    }

    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isVerified: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: "USER_INACTIVE",
        message: "User account is inactive",
      });
    }

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "Admin access required",
      });
    }

    req.user = user;
    req.authMethod = 'cookie';

    next();
  } catch (error) {
    const isExpired = error.name === "TokenExpiredError";

    return res.status(401).json({
      success: false,
      code: isExpired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      message: isExpired ? "Admin session expired. Please login again." : "Invalid admin token",
    });
  }
};

// Customer-specific middleware - only checks Bearer token
const authenticateCustomer = async (req, res, next) => {
  try {
    const token = getCustomerTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        code: "TOKEN_MISSING",
        message: "Customer authentication required",
      });
    }

    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isVerified: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: "USER_INACTIVE",
        message: "User account is inactive",
      });
    }

    req.user = user;
    req.authMethod = 'bearer';

    next();
  } catch (error) {
    const isExpired = error.name === "TokenExpiredError";

    return res.status(401).json({
      success: false,
      code: isExpired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      message: isExpired ? "Token expired" : "Invalid token",
    });
  }
};

// Refresh token endpoint for admin
const refreshAdminToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.adminRefreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        code: "REFRESH_TOKEN_MISSING",
        message: "Refresh token required",
      });
    }

    const decoded = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
        role: 'ADMIN',
        isActive: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Set new cookies (using camelCase)
    res.cookie('adminAccessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    res.cookie('adminRefreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      code: "INVALID_REFRESH_TOKEN",
      message: "Invalid refresh token",
    });
  }
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = String(req.user?.role || "").toUpperCase();

    const normalizedAllowedRoles = allowedRoles.map((role) =>
      String(role).toUpperCase()
    );

    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You are not allowed to access this resource",
      });
    }

    next();
  };
};

module.exports = {
  authenticate: authMiddleware,
  authenticateAdmin,
  authenticateCustomer,
  authorizeRoles,
  refreshAdminToken,
};