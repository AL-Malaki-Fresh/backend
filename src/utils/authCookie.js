const COOKIE_NAMES = Object.freeze({
  adminAccessToken: "adminAccessToken",
  adminRefreshToken: "adminRefreshToken",
  customerAccessToken: "customerAccessToken",
  customerRefreshToken: "customerRefreshToken",
});

const isProduction = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
};

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const getBearerTokenFromRequest = (req) => {
  const authorization = req.headers?.authorization;

  if (
    typeof authorization !== "string" ||
    !authorization.startsWith("Bearer ")
  ) {
    return null;
  }

  const token = authorization.slice(7).trim();

  return token || null;
};

/* =========================================================
   ADMIN COOKIES
========================================================= */

const setAdminAuthCookies = (
  res,
  accessToken,
  refreshToken
) => {
  res.cookie(
    COOKIE_NAMES.adminAccessToken,
    accessToken,
    {
      ...baseCookieOptions,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    }
  );

  res.cookie(
    COOKIE_NAMES.adminRefreshToken,
    refreshToken,
    {
      ...baseCookieOptions,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    }
  );
};

const setAdminAccessCookie = (res, accessToken) => {
  res.cookie(
    COOKIE_NAMES.adminAccessToken,
    accessToken,
    {
      ...baseCookieOptions,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    }
  );
};

const clearAdminAuthCookies = (res) => {
  res.clearCookie(
    COOKIE_NAMES.adminAccessToken,
    baseCookieOptions
  );

  res.clearCookie(
    COOKIE_NAMES.adminRefreshToken,
    baseCookieOptions
  );
};

const getAdminAccessTokenFromRequest = (req) => {
  return (
    req.cookies?.[COOKIE_NAMES.adminAccessToken] ||
    getBearerTokenFromRequest(req)
  );
};

const getAdminRefreshTokenFromRequest = (req) => {
  return (
    req.cookies?.[COOKIE_NAMES.adminRefreshToken] ||
    null
  );
};

/* =========================================================
   CUSTOMER COOKIES
========================================================= */

const setCustomerAuthCookies = (
  res,
  accessToken,
  refreshToken
) => {
  res.cookie(
    COOKIE_NAMES.customerAccessToken,
    accessToken,
    {
      ...baseCookieOptions,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    }
  );

  res.cookie(
    COOKIE_NAMES.customerRefreshToken,
    refreshToken,
    {
      ...baseCookieOptions,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    }
  );
};

const setCustomerAccessCookie = (
  res,
  accessToken
) => {
  res.cookie(
    COOKIE_NAMES.customerAccessToken,
    accessToken,
    {
      ...baseCookieOptions,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    }
  );
};

const clearCustomerAuthCookies = (res) => {
  res.clearCookie(
    COOKIE_NAMES.customerAccessToken,
    baseCookieOptions
  );

  res.clearCookie(
    COOKIE_NAMES.customerRefreshToken,
    baseCookieOptions
  );
};

const getCustomerAccessTokenFromRequest = (req) => {
  return (
    req.cookies?.[COOKIE_NAMES.customerAccessToken] ||
    getBearerTokenFromRequest(req)
  );
};

const getCustomerRefreshTokenFromRequest = (req) => {
  return (
    req.cookies?.[COOKIE_NAMES.customerRefreshToken] ||
    null
  );
};

/*
 * Kept temporarily for old routes that still import it.
 *
 * New admin routes should use authenticateAdmin.
 * New customer/mobile routes should use authenticateCustomer.
 *
 * This function remains ambiguous when both cookies exist,
 * so do not use it for payment routes.
 */
const getAccessTokenFromRequest = (req) => {
  return (
    req.cookies?.[COOKIE_NAMES.adminAccessToken] ||
    req.cookies?.[COOKIE_NAMES.customerAccessToken] ||
    getBearerTokenFromRequest(req)
  );
};

module.exports = {
  COOKIE_NAMES,
  baseCookieOptions,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,

  getBearerTokenFromRequest,

  setAdminAuthCookies,
  setAdminAccessCookie,
  clearAdminAuthCookies,
  getAdminAccessTokenFromRequest,
  getAdminRefreshTokenFromRequest,

  setCustomerAuthCookies,
  setCustomerAccessCookie,
  clearCustomerAuthCookies,
  getCustomerAccessTokenFromRequest,
  getCustomerRefreshTokenFromRequest,

  // Temporary backwards compatibility.
  getAccessTokenFromRequest,
};