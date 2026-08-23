const errorMiddleware = (err, req, res, next) => {
  console.error(err);

  res.status(err.statusCode || 500).json({
    success: false,
    code: err.code || "INTERNAL_SERVER_ERROR",
    message: err.message || "Internal server error",
  });
};

module.exports = errorMiddleware;