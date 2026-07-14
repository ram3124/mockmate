const mongoose = require('mongoose');
const Session = require('../models/Session');
const Feedback = require('../models/Feedback');

// =============================================================================
// Analytics Controller
// =============================================================================
// Provides personalised performance analytics for the logged-in user.
// All endpoints aggregate data from the Session and Feedback collections.
// =============================================================================

/**
 * @desc    Retrieve dashboard statistics for the logged-in user: total
 *          completed sessions, average score, best company, best single
 *          score, and current streak of consecutive practice days.
 * @route   GET /api/analytics/dashboard
 * @access  Protected (any authenticated user)
 *
 * @returns {object} 200 — { success, stats: { totalSessions, avgScore,
 *          bestCompany, bestScore, streak } }
 *
 * Aggregation pipeline logic:
 *   1. $match — filter to this user's completed sessions only
 *   2. $group — compute totalSessions ($sum), avgScore ($avg), bestScore ($max)
 *      all in a single pass over the filtered documents
 *
 * Best company is computed in a separate pipeline because it requires grouping
 * by company first and then picking the top one — a different grouping key
 * than the overall stats aggregation.
 */
const getDashboardStats = async (req, res) => {
  const userId = req.user._id;
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // ── Pipeline 1: Overall stats (totalSessions, avgScore, bestScore) ────
  // Why a single pipeline: All three metrics share the same $match filter
  // and grouping key (null = all docs collapsed into one group), so computing
  // them together avoids scanning the collection multiple times.
  const overallStatsResult = await Session.aggregate([
    // Stage 1: Filter to only this user's completed sessions.
    // Why status: 'completed': Active sessions have no final score yet,
    // including them would skew averages and counts.
    {
      $match: {
        userId: userObjectId,
        status: 'completed',
      },
    },

    // Stage 2: Collapse all matching documents into a single group to
    // compute aggregate metrics across all of this user's sessions.
    {
      $group: {
        _id: null, // null = group ALL matched documents together
        totalSessions: { $sum: 1 },
        avgScore: { $avg: '$totalScore' },
        bestScore: { $max: '$totalScore' },
      },
    },
  ]);

  // If no completed sessions exist, return zeros gracefully.
  // The aggregation returns an empty array when no documents match $match.
  const overallStats = overallStatsResult[0] || {
    totalSessions: 0,
    avgScore: 0,
    bestScore: 0,
  };

  // Round avgScore to 1 decimal for clean display (e.g., 7.3 not 7.33333)
  overallStats.avgScore = overallStats.avgScore
    ? Math.round(overallStats.avgScore * 10) / 10
    : 0;

  // ── Pipeline 2: Best company (highest average score by company) ───────
  // Why a separate pipeline: This requires $group by company (different
  // grouping key than pipeline 1), then $sort + $limit to pick the top one.
  // Merging this into pipeline 1 would require a $facet stage which adds
  // unnecessary complexity for a simple "top 1 by group" query.
  const bestCompanyResult = await Session.aggregate([
    // Stage 1: Same filter as pipeline 1 — only completed sessions for this user
    {
      $match: {
        userId: userObjectId,
        status: 'completed',
      },
    },

    // Stage 2: Group by company and compute the average score per company.
    // This tells us how well the user performs at each company's questions.
    {
      $group: {
        _id: '$company',
        avgScore: { $avg: '$totalScore' },
      },
    },

    // Stage 3: Sort by avgScore descending so the best company is first.
    { $sort: { avgScore: -1 } },

    // Stage 4: Take only the top result — the company where the user
    // performs best on average.
    { $limit: 1 },
  ]);

  const bestCompany = bestCompanyResult.length > 0
    ? {
        company: bestCompanyResult[0]._id,
        avgScore: Math.round(bestCompanyResult[0].avgScore * 10) / 10,
      }
    : null;

  // ── Streak calculation (done in JS, not aggregation) ──────────────────
  // Why application code instead of MongoDB aggregation:
  // Streak requires checking whether consecutive CALENDAR DAYS each have at
  // least one session. This involves:
  //   - Normalizing timestamps to date-only (stripping time)
  //   - De-duplicating dates (multiple sessions on one day = 1 day)
  //   - Checking day-by-day gaps from today backwards
  // While MongoDB's $dateTrunc and $group could handle parts of this, the
  // gap-detection logic (checking that each previous day exists without
  // breaks) is awkward to express in pure aggregation. A simple JS loop
  // is clearer, more maintainable, and easily testable. The number of
  // distinct dates is small (bounded by the user's history) so performance
  // is not a concern.
  const streak = await calculateStreak(userObjectId);

  res.status(200).json({
    success: true,
    stats: {
      totalSessions: overallStats.totalSessions,
      avgScore: overallStats.avgScore,
      bestScore: overallStats.bestScore,
      bestCompany,
      streak,
    },
  });
};

/**
 * @desc    Analyse the user's weakest topics based on average AI feedback
 *          score per question topic. Joins Feedback with Question to get
 *          the topic field, then groups and sorts to find the worst areas.
 * @route   GET /api/analytics/weaknesses
 * @access  Protected (any authenticated user)
 *
 * @returns {object} 200 — { success, weaknesses: [{ topic, avgScore,
 *          numberOfQuestions }] } — up to 5 weakest topics
 *
 * Aggregation pipeline logic:
 *   1. $match — filter Feedback docs to this user (excludes failed evaluations)
 *   2. $lookup — join with Question collection to get the topic field
 *   3. $unwind — flatten the joined array (each Feedback gets its Question)
 *   4. $group — group by topic, compute avg score and count
 *   5. $sort — ascending by avgScore (worst topics first)
 *   6. $limit — return only top 5 weakest
 *   7. $project — shape the output for clean API response
 */
const getWeaknessAnalysis = async (req, res) => {
  const userId = req.user._id;
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const weaknesses = await Feedback.aggregate([
    // Stage 1: Filter to this user's feedback only, excluding entries where
    // the AI evaluation failed (those have score=0 which would unfairly
    // drag down topic averages and don't represent actual performance).
    {
      $match: {
        userId: userObjectId,
        evaluationFailed: { $ne: true },
      },
    },

    // Stage 2: Join with the Question collection to get the topic field.
    // Why $lookup here: Feedback stores questionId but not the topic. We
    // need the topic to group by subject area. Using $lookup avoids
    // denormalizing the topic into every Feedback document.
    {
      $lookup: {
        from: 'questions', // MongoDB collection name (lowercase + plural)
        localField: 'questionId',
        foreignField: '_id',
        as: 'questionDetails',
      },
    },

    // Stage 3: $unwind the joined array. Each Feedback doc matches exactly
    // one Question, so this converts the single-element array into a flat
    // object. preserveNullAndEmptyArrays: false drops Feedback entries
    // whose Question was deleted (no orphaned data in the results).
    {
      $unwind: {
        path: '$questionDetails',
        preserveNullAndEmptyArrays: false,
      },
    },

    // Stage 4: Group by the question's topic. For each topic, compute:
    //   - avgScore: the user's average score on questions in this topic
    //   - numberOfQuestions: how many questions the user has answered
    // Both metrics together give context — a low score on 1 question is
    // less meaningful than a low score across 5 questions.
    {
      $group: {
        _id: '$questionDetails.topic',
        avgScore: { $avg: '$score' },
        numberOfQuestions: { $sum: 1 },
      },
    },

    // Stage 5: Sort ascending by avgScore so the weakest topics appear
    // first. This is the core insight — "where should I focus studying?"
    { $sort: { avgScore: 1 } },

    // Stage 6: Limit to 5. Showing more than 5 weak areas would be
    // overwhelming; the user should focus on their top weaknesses first.
    { $limit: 5 },

    // Stage 7: Reshape for clean API output. Rename _id to topic and
    // round the avgScore to 1 decimal place.
    {
      $project: {
        _id: 0,
        topic: '$_id',
        avgScore: { $round: ['$avgScore', 1] },
        numberOfQuestions: 1,
      },
    },
  ]);

  res.status(200).json({
    success: true,
    count: weaknesses.length,
    weaknesses,
  });
};

/**
 * @desc    Return the user's score trend over their most recent completed
 *          sessions, formatted for direct consumption by a frontend line
 *          chart component (e.g. Recharts). Each data point contains the
 *          session date, score, and company.
 * @route   GET /api/analytics/trend
 * @access  Protected (any authenticated user)
 *
 * @returns {object} 200 — { success, trend: [{ date, score, company }] }
 *          — up to 20 most recent sessions, sorted oldest first
 *
 * Aggregation pipeline logic:
 *   1. $match — filter to this user's completed sessions
 *   2. $sort — by endTime descending (most recent first for $limit)
 *   3. $limit — take only the 20 most recent
 *   4. $sort — re-sort ascending by endTime (line charts read left-to-right)
 *   5. $project — shape output to { date, score, company }
 */
const getScoreTrend = async (req, res) => {
  const userId = req.user._id;
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const trend = await Session.aggregate([
    // Stage 1: Filter to this user's completed sessions only
    {
      $match: {
        userId: userObjectId,
        status: 'completed',
      },
    },

    // Stage 2: Sort by endTime DESCENDING. We sort descending first so that
    // $limit in the next stage keeps the 20 MOST RECENT sessions rather
    // than the 20 oldest.
    { $sort: { endTime: -1 } },

    // Stage 3: Keep only the 20 most recent sessions. This caps the response
    // size to prevent sending hundreds of data points for users with long
    // histories. 20 points produce a readable line chart.
    { $limit: 20 },

    // Stage 4: Re-sort by endTime ASCENDING. Line charts display time
    // left-to-right (oldest → newest), so the frontend expects chronological
    // order. We had to sort descending first for the $limit, now we flip.
    { $sort: { endTime: 1 } },

    // Stage 5: Project only the fields the frontend chart needs.
    // Using 'date' instead of 'endTime' for cleaner chart axis labels.
    {
      $project: {
        _id: 0,
        date: '$endTime',
        score: '$totalScore',
        company: 1,
      },
    },
  ]);

  res.status(200).json({
    success: true,
    count: trend.length,
    trend,
  });
};

// =============================================================================
// Internal Helper: Streak Calculation
// =============================================================================

/**
 * Calculates the user's current practice streak — the number of consecutive
 * calendar days (ending today or yesterday) on which the user completed at
 * least one session.
 *
 * Why this is done in application code instead of MongoDB aggregation:
 * See the detailed comment inside getDashboardStats above.
 *
 * @param {mongoose.Types.ObjectId} userObjectId - The user's ObjectId
 * @returns {Promise<number>} The streak count (0 if no recent sessions)
 */
const calculateStreak = async (userObjectId) => {
  // Fetch only the endTime field for all completed sessions, sorted by
  // most recent first. We only need dates, not full session documents.
  const sessions = await Session.find(
    { userId: userObjectId, status: 'completed' },
    { endTime: 1, _id: 0 },
  ).sort({ endTime: -1 });

  if (sessions.length === 0) return 0;

  // Extract unique calendar dates (normalized to YYYY-MM-DD).
  // Why normalize: Multiple sessions on the same day should count as 1 day.
  // Using a Set of date strings ensures automatic deduplication.
  const uniqueDateStrings = new Set();
  for (const session of sessions) {
    if (session.endTime) {
      // Normalize to local date string (YYYY-MM-DD) to ignore time-of-day
      const dateStr = session.endTime.toISOString().split('T')[0];
      uniqueDateStrings.add(dateStr);
    }
  }

  // Convert to sorted array of Date objects (most recent first)
  const uniqueDates = Array.from(uniqueDateStrings)
    .map((dateStr) => new Date(dateStr))
    .sort((a, b) => b.getTime() - a.getTime());

  if (uniqueDates.length === 0) return 0;

  // The streak must start from today or yesterday. If the most recent
  // session date is older than yesterday, the streak is broken.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const mostRecentDate = uniqueDates[0];
  mostRecentDate.setHours(0, 0, 0, 0);

  // If the most recent session is older than yesterday, streak is 0
  if (mostRecentDate.getTime() < yesterday.getTime()) {
    return 0;
  }

  // Count consecutive days backwards from the most recent date
  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const currentDate = uniqueDates[i];
    currentDate.setHours(0, 0, 0, 0);

    const previousDate = uniqueDates[i - 1];
    previousDate.setHours(0, 0, 0, 0);

    // Calculate the gap in days between this date and the previous one
    const dayDifference = Math.round(
      (previousDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (dayDifference === 1) {
      // Consecutive day — extend the streak
      streak++;
    } else {
      // Gap found — streak is broken, stop counting
      break;
    }
  }

  return streak;
};

module.exports = {
  getDashboardStats,
  getWeaknessAnalysis,
  getScoreTrend,
};
