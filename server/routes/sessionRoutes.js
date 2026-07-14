const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const {
  startSession,
  startSessionValidation,
  getActiveSession,
  submitAnswer,
  submitAnswerValidation,
  completeSession,
  getSessionHistory,
  evaluateSession,
  getSessionReport,
} = require('../controllers/sessionController');

// =============================================================================
// Session Routes — mounted at /api/sessions
// =============================================================================
// All session routes require authentication but NO admin role — these are
// student-facing endpoints for taking mock interviews.
//
// Middleware execution order on each route:
//
//   1. auth            — Verifies JWT and attaches req.user (full Mongoose doc).
//                        Rejects with 401 if token is missing/expired/invalid.
//
//   2. validation[]    — (Where applicable) express-validator middleware that
//                        checks body fields. Errors handled inside the controller.
//
//   3. controller      — The request handler. Ownership checks (ensuring the
//                        session belongs to req.user._id) happen inside the
//                        controller rather than in separate middleware because
//                        they require loading the session document first.
// =============================================================================

// ── POST /api/sessions/start ─────────────────────────────────────────────────
// Start a new mock interview or resume an existing active session.
// Middleware order: auth → body-validation → startSession
router.post('/start', auth, startSessionValidation, startSession);

// ── GET /api/sessions/active ─────────────────────────────────────────────────
// Retrieve the user's currently active session (if any).
// Middleware order: auth → getActiveSession
router.get('/active', auth, getActiveSession);

// ── POST /api/sessions/:id/answer ────────────────────────────────────────────
// Submit or update an answer for a specific question within a session.
// Middleware order: auth → body-validation → submitAnswer
router.post('/:id/answer', auth, submitAnswerValidation, submitAnswer);

// ── POST /api/sessions/:id/complete ──────────────────────────────────────────
// Mark an active session as completed (with timing validation).
// Middleware order: auth → completeSession
router.post('/:id/complete', auth, completeSession);

// ── POST /api/sessions/:id/evaluate ──────────────────────────────────────────
// Trigger AI evaluation for all answers in a completed session.
// Returns existing results if already evaluated (prevents duplicate API costs).
// Middleware order: auth → evaluateSession
router.post('/:id/evaluate', auth, evaluateSession);

// ── GET /api/sessions/:id/report ─────────────────────────────────────────────
// Retrieve the full session report combining questions, answers, and feedback.
// Middleware order: auth → getSessionReport
router.get('/:id/report', auth, getSessionReport);

// ── GET /api/sessions/history ────────────────────────────────────────────────
// Retrieve all completed sessions for the logged-in user (summary view).
// Why this is placed AFTER /:id routes: Express matches routes top-down.
// "history" would match /:id if placed before it, treating "history" as an ID.
// However, since GET /history has no path parameter conflict with POST /:id/*
// routes, and GET /:id/report is also a GET, we place /history last among GETs
// to avoid any ambiguity.
router.get('/history', auth, getSessionHistory);

module.exports = router;
