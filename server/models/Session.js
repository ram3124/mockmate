const mongoose = require('mongoose');

// =============================================================================
// Session Schema
// =============================================================================
// A session represents a single mock interview attempt. It binds a user to a set
// of randomly selected questions and tracks their answers, timing, and score.
// Sessions start as 'active' and transition to 'completed' either when the user
// explicitly finishes or when time expires.
// =============================================================================

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: [true, 'Question ID is required for each answer'],
    },

    text: {
      type: String,
      default: '',
    },

    submittedAt: {
      type: Date,
      // Not required by default — only set when the user actually submits an
      // answer. An empty answer entry without submittedAt means the question
      // was presented but not yet answered.
    },
  },
  {
    // Why _id: false — answer sub-documents don't need their own ObjectIds.
    // They are uniquely identified by questionId within a session. Disabling
    // _id avoids generating unnecessary IDs and simplifies lookups.
    _id: false,
  },
);

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },

    company: {
      type: String,
      required: [true, 'Company is required'],
    },

    type: {
      type: String,
      required: [true, 'Question type is required'],
    },

    status: {
      type: String,
      enum: {
        values: ['active', 'completed'],
        message: 'Status must be either active or completed',
      },
      default: 'active',
    },

    questions: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Question',
        },
      ],
      required: [true, 'Questions array is required'],
      // Why custom validate: Mongoose `required` on arrays considers an empty
      // array as present. A session must have at least one question to be valid.
      validate: {
        validator: function (array) {
          return Array.isArray(array) && array.length >= 1;
        },
        message: 'A session must contain at least 1 question',
      },
    },

    answers: {
      type: [answerSchema],
      default: [],
    },

    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
      default: Date.now,
    },

    endTime: {
      type: Date,
      // Only set when the session transitions to 'completed'.
    },

    totalScore: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// =============================================================================
// Indexes
// =============================================================================
// Why a compound index on (userId, status): the two most frequent queries are
// "find this user's active session" and "find this user's completed sessions".
// A compound index on these fields makes both queries efficient without
// scanning the entire collection.
// =============================================================================
sessionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Session', sessionSchema);
