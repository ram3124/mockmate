  const mongoose = require('mongoose');
  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');

  // -----------------------------------------------------------------------------
  // User Schema
  // -----------------------------------------------------------------------------
  const userSchema = new mongoose.Schema({
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // exclude from query results by default
    },

    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  });

  // -----------------------------------------------------------------------------
  // Instance Methods
  // -----------------------------------------------------------------------------

  /**
   * Compare an entered plaintext password against the stored hash.
   * @param {string} enteredPassword - The plaintext password to verify.
   * @returns {Promise<boolean>}
   */
  userSchema.methods.matchPassword = async function (enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
  };

  /**
   * Generate a signed JSON Web Token for this user.
   * @returns {string} JWT
   */
  userSchema.methods.getSignedJwtToken = function () {
    return jwt.sign(
      {
        userId: this._id,
        email: this.email,
        role: this.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );
  };

  module.exports = mongoose.model('User', userSchema);