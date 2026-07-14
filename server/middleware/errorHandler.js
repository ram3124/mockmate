// -----------------------------------------------------------------------------
// Global error-handling middleware
// Must have 4 parameters so Express recognises it as an error handler.
// -----------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // ── Mongoose Validation Error ──────────────────────────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 400;
    // Collect all field-level validation messages
    const messages = Object.values(err.errors).map((val) => val.message);
    message = messages.join('. ');
  }

  // ── Mongoose Duplicate Key Error (e.g. unique email) ───────────────────
  if (err.code === 11000) {
  statusCode = 400;

  // Duplicate email in User collection
  if (err.keyPattern?.email) {
    message = 'Email already registered';
  }
  // Duplicate feedback/session evaluation
  else if (err.keyPattern?.sessionId) {
    message = 'This session has already been evaluated.';
  }
  // Generic duplicate key
  else {
    message = 'Duplicate data already exists.';
  }
}

  // ── JWT Errors ─────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // ── Send consistent error response ─────────────────────────────────────
  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorHandler;
