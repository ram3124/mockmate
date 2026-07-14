const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const {
  getLeaderboard,
  getMyRank,
  leaderboardQueryValidation,
} = require('../controllers/leaderboardController');

// =============================================================================
// Leaderboard Routes — mounted at /api/leaderboard
// =============================================================================
// All leaderboard routes are protected (login required) but do NOT require
// admin role — any student can view the leaderboard and their own rank.
//
// Both endpoints accept optional company and type query params for filtering.
// Validation middleware checks these params against the allowed enum values
// before the controller runs.
// =============================================================================

// ── GET /api/leaderboard/my-rank ─────────────────────────────────────────────
// Get the logged-in user's rank and percentile for the given filters.
// Why this is defined BEFORE the root GET: Express matches routes top-down.
// If the root GET ('/') were first, 'my-rank' would never match because '/'
// with no path params would catch it. Actually, since 'my-rank' is a literal
// path and '/' is also a literal, there's no conflict. But placing specific
// paths before general ones is a defensive best practice.
// Middleware order: auth → query-validation → getMyRank
router.get('/my-rank', auth, leaderboardQueryValidation, getMyRank);

// ── GET /api/leaderboard ─────────────────────────────────────────────────────
// Get the top 20 leaderboard entries, optionally filtered by company/type.
// Middleware order: auth → query-validation → getLeaderboard
router.get('/', auth, leaderboardQueryValidation, getLeaderboard);

module.exports = router;
