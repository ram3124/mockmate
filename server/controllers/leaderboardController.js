const mongoose = require('mongoose');
const { query, validationResult } = require('express-validator');
const Session = require('../models/Session');
const Question = require('../models/Question');

// -----------------------------------------------------------------------------
// Enum references — pulled from Question model statics to stay in sync.
// -----------------------------------------------------------------------------
const ALLOWED_COMPANIES = Question.getAllowedCompanies();
const ALLOWED_TYPES = Question.getAllowedTypes();

// =============================================================================
// Shared Helpers
// =============================================================================

/**
 * Inspects express-validator results. If validation errors exist, sends a 400
 * response and returns `true` so the caller can abort.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {boolean} `true` if a 400 response was sent.
 */
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
    return true;
  }
  return false;
};

// =============================================================================
// Validation Chains
// =============================================================================

/** Validation rules for leaderboard query params (both endpoints share these). */
const leaderboardQueryValidation = [
  query('company')
    .optional()
    .trim()
    .isIn(ALLOWED_COMPANIES)
    .withMessage(`Invalid company filter. Allowed: ${ALLOWED_COMPANIES.join(', ')}`),

  query('type')
    .optional()
    .trim()
    .isIn(ALLOWED_TYPES)
    .withMessage(`Invalid type filter. Allowed: ${ALLOWED_TYPES.join(', ')}`),
];

// =============================================================================
// Controller Functions
// =============================================================================

/**
 * @desc    Retrieve the top 20 leaderboard entries, optionally filtered by
 *          company and/or question type. For each user, only their BEST score
 *          is shown (not every session). User names are anonymized to
 *          "FirstName L." format for privacy.
 * @route   GET /api/leaderboard
 * @access  Protected (any authenticated user)
 *
 * @queryparam {string} [company] — Filter to sessions for this company
 * @queryparam {string} [type]    — Filter to sessions of this question type
 *
 * @returns {object} 200 — { success, filters, leaderboard: [{ rank, name, score }] }
 *
 * Aggregation pipeline logic:
 *   1. $match — filter completed sessions (+ optional company/type)
 *   2. $group — group by userId, take $max totalScore per user
 *   3. $lookup — join with User collection to get the name
 *   4. $unwind — flatten the user lookup result
 *   5. $project — shape output with anonymized name
 *   6. $sort — descending by score
 *   7. $limit — top 20
 */
const getLeaderboard = async (req, res) => {
  // 1. Validate query params
  if (handleValidationErrors(req, res)) return;

  // 2. Build the match filter
  const matchFilter = { status: 'completed' };
  if (req.query.company) matchFilter.company = req.query.company;
  if (req.query.type) matchFilter.type = req.query.type;

  const leaderboardResult = await Session.aggregate([
    // Stage 1: Filter to completed sessions matching the optional company/type.
    // Why completed only: Active sessions have no final score and would
    // appear as 0, polluting the leaderboard.
    { $match: matchFilter },

    // Stage 2: Group by userId and take the MAX totalScore across all of
    // this user's matching sessions. A user may have taken 10 sessions for
    // "Amazon DSA" but only their best performance should appear on the
    // leaderboard. Using $max ensures we surface each user's peak.
    {
      $group: {
        _id: '$userId',
        score: { $max: '$totalScore' },
      },
    },

    // Stage 3: $lookup to join with the User collection. We need the user's
    // name to display on the leaderboard. The join is on userId (_id from
    // $group) → User._id.
    {
      $lookup: {
        from: 'users', // MongoDB collection name (lowercase + plural)
        localField: '_id',
        foreignField: '_id',
        as: 'userDetails',
      },
    },

    // Stage 4: $unwind the joined user array. Each userId maps to exactly
    // one User document. If the user was deleted, preserveNullAndEmptyArrays
    // false will drop that entry (no ghost entries on the leaderboard).
    {
      $unwind: {
        path: '$userDetails',
        preserveNullAndEmptyArrays: false,
      },
    },

    // Stage 5: Project the final output shape.
    // IMPORTANT — Privacy: We anonymize names to "FirstName L." format.
    // Why: The leaderboard is visible to all authenticated users. Showing
    // full names could expose personal information. Showing only the first
    // name and last initial provides enough identification for friendly
    // competition without compromising privacy. Emails are NEVER included.
    {
      $project: {
        _id: 0,
        userId: '$_id',
        score: 1,
        // $split the name by space, take the first element as firstName.
        // For the last initial, take the first character of the last element.
        // If the name has no space (single word), the initial will be empty.
        fullName: '$userDetails.name',
      },
    },

    // Stage 6: Sort by score descending — highest scorers at the top.
    { $sort: { score: -1 } },

    // Stage 7: Limit to 20 entries. A leaderboard longer than 20 becomes
    // unwieldy and less motivating for users not in the top ranks.
    { $limit: 20 },
  ]);

  // Post-process to add rank numbers and anonymize names.
  // Why post-process instead of in the pipeline: MongoDB aggregation cannot
  // easily add sequential rank numbers (1, 2, 3...) within the pipeline.
  // A simple .map() with index is cleaner than using $setWindowFields which
  // requires MongoDB 5.0+ and adds complexity.
  const leaderboard = leaderboardResult.map((entry, index) => ({
    rank: index + 1,
    name: anonymizeName(entry.fullName),
    score: entry.score,
  }));

  res.status(200).json({
    success: true,
    filters: {
      company: req.query.company || 'all',
      type: req.query.type || 'all',
    },
    count: leaderboard.length,
    leaderboard,
  });
};

/**
 * @desc    Calculate the logged-in user's rank and percentile for the given
 *          company/type filter. Shows how they compare against other students.
 * @route   GET /api/leaderboard/my-rank
 * @access  Protected (any authenticated user)
 *
 * @queryparam {string} [company] — Filter to sessions for this company
 * @queryparam {string} [type]    — Filter to sessions of this question type
 *
 * @returns {object} 200 — { success, userBestScore, rank, totalUsers,
 *          percentile, message }
 *
 * Aggregation pipeline logic:
 *   1. $match — filter completed sessions (+ optional company/type)
 *   2. $group — group by userId, take $max totalScore per user
 *   3. $sort — descending by score for rank calculation
 *
 * The rank and percentile are computed in application code after the
 * aggregation because they require finding the current user's position
 * within the sorted list — a conditional lookup that is simpler in JS
 * than in a MongoDB pipeline.
 */
const getMyRank = async (req, res) => {
  // 1. Validate query params
  if (handleValidationErrors(req, res)) return;

  const userId = req.user._id;
  const userIdStr = userId.toString();

  // 2. Build the match filter
  const matchFilter = { status: 'completed' };
  if (req.query.company) matchFilter.company = req.query.company;
  if (req.query.type) matchFilter.type = req.query.type;

  // 3. Aggregation: get every user's best score for this filter, sorted desc
  const allUserScores = await Session.aggregate([
    // Stage 1: Filter to completed sessions with optional company/type
    { $match: matchFilter },

    // Stage 2: Group by userId and take max score. Same logic as the
    // leaderboard — we compare users by their best performance, not average.
    {
      $group: {
        _id: '$userId',
        bestScore: { $max: '$totalScore' },
      },
    },

    // Stage 3: Sort descending by bestScore for rank assignment.
    { $sort: { bestScore: -1 } },
  ]);

  const totalUsers = allUserScores.length;

  // 4. Find the current user in the sorted results
  const userEntryIndex = allUserScores.findIndex(
    (entry) => entry._id.toString() === userIdStr,
  );

  // If the user has no sessions matching the filter, return a clear message
  if (userEntryIndex === -1) {
    const filterDesc = [];
    if (req.query.company) filterDesc.push(`company="${req.query.company}"`);
    if (req.query.type) filterDesc.push(`type="${req.query.type}"`);
    const filterStr = filterDesc.length > 0
      ? ` for ${filterDesc.join(' and ')}`
      : '';

    return res.status(200).json({
      success: true,
      message: `You have not completed any sessions${filterStr} yet. Complete a session to see your rank.`,
      userBestScore: null,
      rank: null,
      totalUsers,
      percentile: null,
    });
  }

  const userBestScore = allUserScores[userEntryIndex].bestScore;
  const rank = userEntryIndex + 1; // 0-indexed → 1-indexed

  // 5. Calculate percentile: what percentage of OTHER users scored LOWER.
  //    Formula: (number of users with a lower score / total users) * 100
  //    Why "lower" not "lower or equal": If 3 users all have the same score,
  //    they should each see a high percentile, not penalize each other.
  //    A user who is #1 out of 1 should see 100%, not 0%.
  const usersWithLowerScore = allUserScores.filter(
    (entry) => entry.bestScore < userBestScore,
  ).length;

  const percentile = totalUsers > 1
    ? Math.round((usersWithLowerScore / (totalUsers - 1)) * 100)
    : 100; // If you're the only user, you're in the 100th percentile

  // Build a human-readable message for the frontend
  const filterParts = [];
  if (req.query.company) filterParts.push(req.query.company);
  if (req.query.type) filterParts.push(req.query.type);
  const filterLabel = filterParts.length > 0
    ? filterParts.join(' ')
    : 'all categories';

  res.status(200).json({
    success: true,
    userBestScore,
    rank,
    totalUsers,
    percentile,
    message: `You scored higher than ${percentile}% of students for ${filterLabel}.`,
  });
};

// =============================================================================
// Internal Helper: Name Anonymization
// =============================================================================

/**
 * Anonymizes a full name to "FirstName L." format for privacy on the
 * leaderboard. If the name has no space (single word), returns it as-is.
 *
 * @param {string} fullName - The user's full name from the User document
 * @returns {string} Anonymized name (e.g., "Rahul S.")
 *
 * @example
 *   anonymizeName("Rahul Sharma") → "Rahul S."
 *   anonymizeName("Rahul")        → "Rahul"
 *   anonymizeName("")             → "Anonymous"
 */
const anonymizeName = (fullName) => {
  if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
    return 'Anonymous';
  }

  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0];
  }

  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();

  return `${firstName} ${lastInitial}.`;
};

module.exports = {
  getLeaderboard,
  getMyRank,
  leaderboardQueryValidation,
};
