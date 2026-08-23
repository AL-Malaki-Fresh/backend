const userService = require(
  "../../services/user.service"
);

const {
  setAdminAuthCookies,
  setAdminAccessCookie,
  clearAdminAuthCookies,
  getAdminRefreshTokenFromRequest,
} = require("../../utils/authCookie");

const login = async (req, res, next) => {
  try {
    const result =
      await userService.loginUser({
        ...req.body,
        allowedRole: "ADMIN",
      });

    setAdminAuthCookies(
      res,
      result.accessToken,
      result.refreshToken
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      code: "ADMIN_LOGIN_SUCCESS",
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const refreshToken = async (
  req,
  res,
  next
) => {
  try {
    const refreshTokenValue =
      getAdminRefreshTokenFromRequest(req);

    if (!refreshTokenValue) {
      return res.status(401).json({
        success: false,
        code: "REFRESH_TOKEN_MISSING",
        message: "Refresh token is missing",
      });
    }

    const result =
      await userService.refreshAccessToken(
        refreshTokenValue,
        "ADMIN"
      );

    setAdminAccessCookie(
      res,
      result.accessToken
    );

    return res.status(200).json({
      success: true,
      message: "Session refreshed",
      code: "ADMIN_TOKEN_REFRESH_SUCCESS",
    });
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    clearAdminAuthCookies(res);

    return res.status(200).json({
      success: true,
      message: "Logout successful",
      code: "ADMIN_LOGOUT_SUCCESS",
    });
  } catch (error) {
    return next(error);
  }
};

const getCurrentAdmin = async (
  req,
  res,
  next
) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  login,
  refreshToken,
  logout,
  getCurrentAdmin,
};