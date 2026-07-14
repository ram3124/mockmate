  // -----------------------------------------------------------------------------
  // Role-based authorization middleware factory
  // Usage: roleAuth('admin', 'student')
  // -----------------------------------------------------------------------------

  /**
   * Returns middleware that checks whether the authenticated user's role
   * is included in the provided allowed roles.
   *
   * @param  {...string} roles - Allowed roles (e.g. 'admin', 'student')
   * @returns {Function} Express middleware
   */
  const roleAuth = (...roles) => {
    return (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
        });
      }

      next();
    };
  };

  module.exports = roleAuth;
