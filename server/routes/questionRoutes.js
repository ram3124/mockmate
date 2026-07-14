  const express = require('express');
  const router = express.Router();

  const auth = require('../middleware/auth');
  const roleAuth = require('../middleware/roleAuth');
  const {
    getQuestions,
    getQuestionsQueryValidation,
    getQuestionById,
    createQuestion,
    createQuestionValidation,
    updateQuestion,
    updateQuestionValidation,
    deleteQuestion,
  } = require('../controllers/questionController');

  // =============================================================================
  // Question Routes — mounted at /api/questions
  // =============================================================================
  // Middleware execution order on each route:
  //
  //   1. auth          — Verifies the JWT in the Authorization header and attaches
  //                      the authenticated user to req.user. Rejects with 401 if
  //                      the token is missing, expired, or invalid.
  //
  //   2. roleAuth(…)   — (Admin routes only) Checks that req.user.role is in the
  //                      allowed set. Rejects with 403 if the user lacks the
  //                      required role. Skipped for student-accessible endpoints.
  //
  //   3. validation[]  — express-validator middleware array that validates
  //                      query params (GET) or body fields (POST/PUT). Errors are
  //                      checked inside the controller via validationResult().
  //
  //   4. controller    — The actual request handler. Runs only if all preceding
  //                      middleware called next().
  // =============================================================================

  // ── GET /api/questions ───────────────────────────────────────────────────────
  // Protected: any authenticated user can fetch questions.
  // Middleware order: auth → query-validation → getQuestions
  router.get('/', auth, getQuestionsQueryValidation, getQuestions);

  // ── GET /api/questions/:id ───────────────────────────────────────────────────
  // Protected: any authenticated user can view a single question.
  // Middleware order: auth → getQuestionById (id validation happens in controller)
  router.get('/:id', auth, getQuestionById);

  // ── POST /api/questions ──────────────────────────────────────────────────────
  // Protected + Admin only: only admins can create new questions.
  // Middleware order: auth → roleAuth(['admin']) → body-validation → createQuestion
  router.post(
    '/',
    auth,
    roleAuth('admin'),
    createQuestionValidation,
    createQuestion,
  );

  // ── PUT /api/questions/:id ───────────────────────────────────────────────────
  // Protected + Admin only: only admins can update existing questions.
  // Middleware order: auth → roleAuth(['admin']) → body-validation → updateQuestion
  router.put(
    '/:id',
    auth,
    roleAuth('admin'),
    updateQuestionValidation,
    updateQuestion,
  );

  // ── DELETE /api/questions/:id ────────────────────────────────────────────────
  // Protected + Admin only: only admins can delete questions.
  // Middleware order: auth → roleAuth(['admin']) → deleteQuestion
  router.delete('/:id', auth, roleAuth('admin'), deleteQuestion);

  module.exports = router;
