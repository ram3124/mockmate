  const bcrypt = require('bcryptjs');
  const { body, validationResult } = require('express-validator');
  const User = require('../models/User');

  // -----------------------------------------------------------------------------
  // Validation chains (re-usable as route-level middleware)
  // -----------------------------------------------------------------------------

  /** Validation rules for the register endpoint */
  const registerValidation = [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ];

  /** Validation rules for the login endpoint */
  const loginValidation = [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ];

  // -----------------------------------------------------------------------------
  // @desc    Register a new user
  // @route   POST /api/auth/register
  // @access  Public
  // -----------------------------------------------------------------------------
  const register = async (req, res) => {
    // 1. Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { name, email, password, role } = req.body;

    // 2. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // 3. Hash the password (12 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 12);

    // 4. Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    // 5. Generate JWT
    const token = user.getSignedJwtToken();

    // 6. Respond (exclude password from response)
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  };

  // -----------------------------------------------------------------------------
  // @desc    Login user & return JWT
  // @route   POST /api/auth/login
  // @access  Public
  // -----------------------------------------------------------------------------
  const login = async (req, res) => {
    // 1. Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // 2. Find user and explicitly include the password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // 3. Compare passwords
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // 4. Generate JWT
    const token = user.getSignedJwtToken();

    // 5. Respond
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  };

  // -----------------------------------------------------------------------------
  // @desc    Get current logged-in user
  // @route   GET /api/auth/me
  // @access  Private
  // -----------------------------------------------------------------------------
  const getMe = async (req, res) => {
    res.status(200).json({
      success: true,
      user: req.user,
    });
  };

  module.exports = {
    register,
    registerValidation,
    login,
    loginValidation,
    getMe,
  };
