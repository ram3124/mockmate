const express = require('express');
const router = express.Router();

const {
  register,
  registerValidation,
  login,
  loginValidation,
  getMe,
} = require('../controllers/authController');
const auth = require('../middleware/auth');

// -----------------------------------------------------------------------------
// Auth Routes — mounted at /api/auth
// -----------------------------------------------------------------------------

// POST /api/auth/register
// RIGHT: Pass the validation array as middleware
router.post('/register', registerValidation, register);

// POST /api/auth/login
router.post('/login', loginValidation, login);

// GET  /api/auth/me  (protected)
router.get('/me', auth, getMe);

module.exports = router;
