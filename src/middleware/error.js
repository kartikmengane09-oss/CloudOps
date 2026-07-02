const config = require('../config/environment');

/**
 * Handles 404 - Not Found errors for unmatched routes
 */
function notFoundHandler(req, res, next) {
  const err = new Error(`Not Found - ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

/**
 * Centralized Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.status || 500;
  
  // Log the trace internally
  console.error(`[ERROR] [Code ${statusCode}] ${err.message}`);
  if (config.nodeEnv !== 'production' && err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    status: 'error',
    statusCode: statusCode,
    message: err.message || 'Internal Server Error',
    // Suppress stack trace in production for security
    ...(config.nodeEnv !== 'production' && { stack: err.stack })
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
