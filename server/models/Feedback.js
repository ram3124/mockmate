const mongoose = require('mongoose');

// =============================================================================
// Feedback Schema
// =============================================================================
// Stores the AI evaluation result for a single question within a session.
// Each Feedback document corresponds to one (session, question) pair. The
// `evaluationFailed` flag allows the frontend to gracefully display
// "evaluation unavailable" instead of crashing when the AI service had an error.
// =============================================================================

const feedbackSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: [true, 'Session ID is required'],
    },

    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: [true, 'Question ID is required'],
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },

    score: {
      type: Number,
      required: [true, 'Score is required'],
      min: [0, 'Score cannot be less than 0'],
      max: [10, 'Score cannot exceed 10'],
    },

    missingPoints: {
      type: [String],
      default: [],
    },

    positives: {
      type: [String],
      default: [],
    },

    tip: {
      type: String,
      required: [true, 'Tip is required'],
    },

    modelAnswer: {
      type: String,
      required: [true, 'Model answer is required'],
    },

    evaluationFailed: {
      type: Boolean,
      default: false,
      // Why this flag exists: When the AI API call fails (network error,
      // rate limit, parsing error), we still create a Feedback document with
      // score 0 and this flag set to true. This way the frontend can
      // distinguish between "student scored 0" and "evaluation unavailable"
      // and render the UI accordingly instead of breaking entirely.
    },
  },
  {
    timestamps: true,
  },
);

// =============================================================================
// Compound Index
// =============================================================================
// The most common query is "find all feedback for a given session" (used in
// the report endpoint). A compound index on (sessionId, questionId) covers
// both the "all feedback for session" query and the "specific feedback for
// session + question" existence check, while also preventing duplicate
// evaluations for the same (session, question) pair.
// =============================================================================
feedbackSchema.index({ sessionId: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
