const { Prisma } = require("@prisma/client");

// Known Prisma error codes mapped to safe, generic client-facing messages.
// Full list: https://www.prisma.io/docs/orm/reference/error-reference
const PRISMA_KNOWN_ERRORS = {
  P2002: { status: 409, message: "A record with these details already exists" },
  P2003: { status: 400, message: "Invalid reference to a related record" },
  P2025: { status: 404, message: "Record not found" },
};

const errorMiddleware = (err, req, res, next) => {
  console.error(err);

  // Malformed JSON bodies from express.json()/body-parser surface as a
  // SyntaxError with `status` (not `statusCode`) — map it to a proper 400
  // instead of falling through to the generic 500 below.
  if (err.type === "entity.parse.failed" || (err instanceof SyntaxError && "body" in err)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_JSON",
      message: "Malformed JSON in request body",
    });
  }

  // CORS rejection (see src/app.js) — surface as 403, not a generic 500.
  if (typeof err.message === "string" && err.message.startsWith("Not allowed by CORS")) {
    return res.status(403).json({
      success: false,
      code: "CORS_NOT_ALLOWED",
      message: "Origin not allowed",
    });
  }

  // Prisma errors — never leak raw internal error messages (table/column
  // names, connection strings, etc.) straight to the API response.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_KNOWN_ERRORS[err.code] || { status: 400, message: "Invalid request" };
    return res.status(mapped.status).json({
      success: false,
      code: err.code,
      message: mapped.message,
    });
  }
  if (
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return res.status(500).json({
      success: false,
      code: "DATABASE_ERROR",
      message: "A database error occurred",
    });
  }

  // Operational errors created via each service's `createError(message, statusCode, code)`
  // helper are safe to show verbatim. Anything else is an unexpected bug — never echo
  // its raw message back to the client.
  const statusCode = err.statusCode || err.status;
  if (statusCode) {
    return res.status(statusCode).json({
      success: false,
      code: err.code || "REQUEST_ERROR",
      message: err.message || "Request error",
    });
  }

  res.status(500).json({
    success: false,
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
  });
};

module.exports = errorMiddleware;
