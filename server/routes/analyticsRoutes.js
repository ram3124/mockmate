const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const {
  getDashboardStats,
  getWeaknessAnalysis,
  getScoreTrend,
} = require('../controllers/analyticsController');

// =============================================================================
// Analytics Routes — mounted at /api/analytics
// =============================================================================
// All analytics routes are protected (login required) but do NOT require admin
// role — they show personalised data scoped to req.user._id only.
//
// No validation middleware is needed because these endpoints take no body
// or query params — they derive everything from the authenticated user's ID.
// =============================================================================

// ── GET /api/analytics/dashboard ─────────────────────────────────────────────
// Dashboard overview: total sessions, avg score, best company, best score, streak.
// Middleware order: auth → getDashboardStats
router.get('/dashboard', auth, getDashboardStats);

// ── GET /api/analytics/weaknesses ────────────────────────────────────────────
// Top 5 weakest topics based on average AI feedback score.
// Middleware order: auth → getWeaknessAnalysis
router.get('/weaknesses', auth, getWeaknessAnalysis);

// ── GET /api/analytics/trend ─────────────────────────────────────────────────
// Score trend over the last 20 completed sessions (for chart rendering).
// Middleware order: auth → getScoreTrend
router.get('/trend', auth, getScoreTrend);

module.exports = router;
