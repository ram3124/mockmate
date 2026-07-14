const mongoose = require('mongoose');

// -----------------------------------------------------------------------------
// Allowed enum values — exported as statics so controllers can reference them
// for input validation without hardcoding duplicate lists.
// -----------------------------------------------------------------------------
const ALLOWED_COMPANIES = [
  'Google',
  'Amazon',
  'Flipkart',
  'Microsoft',
  'TCS',
  'Infosys',
  'General',
];

const ALLOWED_TYPES = ['DSA', 'HR', 'CoreCS', 'SystemDesign'];

const ALLOWED_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

// -----------------------------------------------------------------------------
// Question Schema
// -----------------------------------------------------------------------------
const questionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
      minlength: [10, 'Question text must be at least 10 characters'],
    },

    company: {
      type: String,
      required: [true, 'Company is required'],
      enum: {
        values: ALLOWED_COMPANIES,
        message: 'Company must be one of: {VALUE} is not valid. Allowed: ' +
          ALLOWED_COMPANIES.join(', '),
      },
    },

    type: {
      type: String,
      required: [true, 'Question type is required'],
      enum: {
        values: ALLOWED_TYPES,
        message: 'Type must be one of: {VALUE} is not valid. Allowed: ' +
          ALLOWED_TYPES.join(', '),
      },
    },

    difficulty: {
      type: String,
      enum: {
        values: ALLOWED_DIFFICULTIES,
        message: 'Difficulty must be one of: {VALUE} is not valid. Allowed: ' +
          ALLOWED_DIFFICULTIES.join(', '),
      },
      default: 'Medium',
    },

    topic: {
      type: String,
      required: [true, 'Topic is required'],
      trim: true,
    },

    keyPoints: {
      type: [String],
      required: [true, 'Key points are required'],
      // Why a custom validator: Mongoose considers an empty array as "present"
      // for the `required` check, so we need an explicit length check to
      // guarantee at least one meaningful evaluation criterion exists.
      validate: {
        validator: function (array) {
          return Array.isArray(array) && array.length >= 1;
        },
        message: 'keyPoints must contain at least 1 item',
      },
    },

    modelAnswer: {
      type: String,
      required: [true, 'Model answer is required'],
      minlength: [20, 'Model answer must be at least 20 characters'],
    },

    timeLimit: {
      type: Number,
      default: 300,
      min: [60, 'Time limit must be at least 60 seconds'],
      max: [1800, 'Time limit cannot exceed 1800 seconds (30 minutes)'],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // Not required because seed scripts may create questions without a
      // logged-in user context. In normal API usage, the controller sets this.
    },
  },
  {
    timestamps: true,
  },
);

// -----------------------------------------------------------------------------
// Pre-save Hook — Normalize topic to Title Case
// -----------------------------------------------------------------------------
// Why: Topics arrive in inconsistent casing (e.g. "arrays", "ARRAYS", "Arrays").
// Normalizing on save ensures consistent filtering and display without needing
// case-insensitive queries everywhere.
// -----------------------------------------------------------------------------
questionSchema.pre('save', function () {
  if (this.isModified('topic')) {
    this.topic = this.topic
      .split(' ')
      .map(
        (word) =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join(' ');
  }
});

// -----------------------------------------------------------------------------
// Statics — expose enum lists for runtime validation in controllers
// -----------------------------------------------------------------------------
questionSchema.statics.getAllowedCompanies = function () {
  return ALLOWED_COMPANIES;
};

questionSchema.statics.getAllowedTypes = function () {
  return ALLOWED_TYPES;
};

questionSchema.statics.getAllowedDifficulties = function () {
  return ALLOWED_DIFFICULTIES;
};

module.exports = mongoose.model('Question', questionSchema);
