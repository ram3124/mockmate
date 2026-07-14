const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Session = require('../models/Session');
const Question = require('../models/Question');
const Feedback = require('../models/Feedback');
const aiService = require('../services/aiService');

// -----------------------------------------------------------------------------
// Enum references — pulled from Question model statics to stay in sync.
// -----------------------------------------------------------------------------
const ALLOWED_COMPANIES = Question.getAllowedCompanies();
const ALLOWED_TYPES = Question.getAllowedTypes();
const ALLOWED_DIFFICULTIES = Question.getAllowedDifficulties();

// =============================================================================
// Shared Helpers
// =============================================================================

/**
 * Inspects express-validator results. If validation errors exist, sends a 400
 * response and returns `true` so the caller can abort. Returns `false` when
 * there are no errors.
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

/**
 * Checks whether a string is a valid MongoDB ObjectId format. Validated early
 * to prevent Mongoose CastErrors from reaching the global error handler.
 *
 * @param {string} id
 * @returns {boolean}
 */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * The fields to include when populating questions for the frontend. We
 * deliberately EXCLUDE `keyPoints` and `modelAnswer` because those are for
 * backend AI evaluation only — sending them to the frontend would let users
 * see the expected answers during an active interview, defeating the purpose.
 */
const FRONTEND_QUESTION_FIELDS = 'text company type difficulty topic timeLimit';

// =============================================================================
// Validation Chains
// =============================================================================

/** Validation rules for POST /api/sessions/start */
const startSessionValidation = [
  body('company')
    .trim()
    .notEmpty().withMessage('Company is required')
    .isIn(ALLOWED_COMPANIES)
    .withMessage(`Company must be one of: ${ALLOWED_COMPANIES.join(', ')}`),

  body('type')
    .trim()
    .notEmpty().withMessage('Question type is required')
    .isIn(ALLOWED_TYPES)
    .withMessage(`Type must be one of: ${ALLOWED_TYPES.join(', ')}`),

  body('count')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('count must be an integer between 1 and 20'),

  body('difficulty')
    .optional()
    .trim()
    .isIn(ALLOWED_DIFFICULTIES)
    .withMessage(`Difficulty must be one of: ${ALLOWED_DIFFICULTIES.join(', ')}`),
];

/** Validation rules for POST /api/sessions/:id/answer */
const submitAnswerValidation = [
  body('questionId')
    .trim()
    .notEmpty().withMessage('questionId is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('questionId must be a valid ObjectId');
      }
      return true;
    }),

  body('text')
    .isString().withMessage('Answer text must be a string'),
];

// =============================================================================
// Controller Functions
// =============================================================================

/**
 * @desc    Start a new mock interview session, or resume an existing active one.
 *          Queries the Question collection for random questions matching the
 *          requested company, type, and optional difficulty. Calculates the
 *          total allowed time from the sum of each question's timeLimit.
 * @route   POST /api/sessions/start
 * @access  Protected (any authenticated user)
 *
 * @bodyparam {string} company             — Target company (must be in ALLOWED_COMPANIES)
 * @bodyparam {string} type                — Question type (must be in ALLOWED_TYPES)
 * @bodyparam {number} [count=5]           — Number of questions (1–20, default 5)
 * @bodyparam {string} [difficulty]        — Optional difficulty filter
 *
 * @returns {object} 200 — existing active session if one already exists (enables resume)
 * @returns {object} 201 — newly created session with populated questions
 * @returns {object} 400 — validation errors or no matching questions found
 */
const startSession = async (req, res) => {
  // 1. Validate request body
  if (handleValidationErrors(req, res)) return;

  const userId = req.user._id;
  const { company, type, difficulty } = req.body;
  const requestedCount = parseInt(req.body.count, 10);
  const questionCount = Number.isNaN(requestedCount) ? 5 : Math.min(Math.max(requestedCount, 1), 20);

  // 2. Check if user already has an active session.
  //    Why: Prevents orphaned sessions — if a user refreshes mid-interview or
  //    their browser crashes, they can resume by calling this endpoint again
  //    rather than being stuck with a ghost session blocking new ones.
  const existingSession = await Session.findOne({
    userId,
    status: 'active',
  }).populate('questions', FRONTEND_QUESTION_FIELDS);

  if (existingSession) {
    // Calculate remaining time for the resumed session
    const totalAllowedTimeMs = await calculateTotalAllowedTime(existingSession.questions);
    const elapsedMs = Date.now() - existingSession.startTime.getTime();
    const remainingTimeSeconds = Math.max(
      0,
      Math.floor((totalAllowedTimeMs - elapsedMs) / 1000),
    );

    // If time has already expired, auto-complete the session instead of
    // returning a stale active session that the user cannot interact with.
    if (remainingTimeSeconds <= 0) {
      existingSession.status = 'completed';
      existingSession.endTime = new Date();
      await existingSession.save();

      return res.status(200).json({
        success: true,
        message: 'Previous active session has expired and was auto-completed.',
        session: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Resuming existing active session.',
      session: existingSession,
      totalAllowedTimeSeconds: Math.floor(totalAllowedTimeMs / 1000),
      remainingTimeSeconds,
    });
  }

  // 3. Build the aggregation pipeline to fetch random matching questions.
  //    $match MUST come before $sample — see questionController.js for the
  //    detailed explanation of why ordering matters with MongoDB sampling.
  const matchFilter = { company, type };
  if (difficulty) {
    matchFilter.difficulty = difficulty;
  }

  const pipeline = [
    { $match: matchFilter },
    { $sample: { size: questionCount } },
  ];

  const selectedQuestions = await Question.aggregate(pipeline);

  if (selectedQuestions.length === 0) {
    return res.status(400).json({
      success: false,
      message: `No questions found matching company="${company}", type="${type}"${difficulty ? `, difficulty="${difficulty}"` : ''}. Try different filters or seed the database first.`,
    });
  }

  // 4. Extract question IDs and pre-populate the answers array with empty
  //    entries. This makes it easy to track which questions were presented
  //    vs which were actually answered (submittedAt will be null until answered).
  const questionIds = selectedQuestions.map((q) => q._id);
  const emptyAnswers = questionIds.map((qId) => ({
    questionId: qId,
    text: '',
  }));

  // 5. Create the session
  const session = await Session.create({
    userId,
    company,
    type,
    status: 'active',
    questions: questionIds,
    answers: emptyAnswers,
    startTime: new Date(),
  });

  // 6. Populate questions for the response, excluding keyPoints and modelAnswer
  await session.populate('questions', FRONTEND_QUESTION_FIELDS);

  // 7. Calculate total allowed time from the sum of each question's timeLimit
  const totalAllowedTimeSeconds = selectedQuestions.reduce(
    (sum, question) => sum + (question.timeLimit || 300),
    0,
  );

  res.status(201).json({
    success: true,
    message: 'Session started successfully.',
    session,
    totalAllowedTimeSeconds,
    remainingTimeSeconds: totalAllowedTimeSeconds,
  });
};

/**
 * @desc    Retrieve the currently active session for the logged-in user.
 *          If the session's time has expired, it is automatically marked as
 *          completed and null is returned instead.
 * @route   GET /api/sessions/active
 * @access  Protected (any authenticated user)
 *
 * @returns {object} 200 — { session, totalAllowedTimeSeconds, remainingTimeSeconds }
 *                         or { session: null } if no active session
 */
const getActiveSession = async (req, res) => {
  const userId = req.user._id;

  const session = await Session.findOne({
    userId,
    status: 'active',
  }).populate('questions', FRONTEND_QUESTION_FIELDS);

  if (!session) {
    return res.status(200).json({
      success: true,
      message: 'No active session found.',
      session: null,
    });
  }

  // Calculate timing information
  const totalAllowedTimeMs = await calculateTotalAllowedTime(session.questions);
  const elapsedMs = Date.now() - session.startTime.getTime();
  const remainingTimeSeconds = Math.max(
    0,
    Math.floor((totalAllowedTimeMs - elapsedMs) / 1000),
  );

  // If time has expired, auto-complete the session rather than returning
  // a zombie active session that the frontend cannot meaningfully interact with.
  if (remainingTimeSeconds <= 0) {
    session.status = 'completed';
    session.endTime = new Date();
    await session.save();

    return res.status(200).json({
      success: true,
      message: 'Active session has expired and was auto-completed.',
      session: null,
    });
  }

  res.status(200).json({
    success: true,
    session,
    totalAllowedTimeSeconds: Math.floor(totalAllowedTimeMs / 1000),
    remainingTimeSeconds,
  });
};

/**
 * @desc    Submit or update an answer for a specific question within an active
 *          session. If an answer entry for the given questionId already exists,
 *          it is updated in place; otherwise a new entry is pushed.
 *          Returns a lightweight confirmation (not the full session) because
 *          this endpoint is called frequently during an interview.
 * @route   POST /api/sessions/:id/answer
 * @access  Protected (any authenticated user)
 *
 * @param   {string} req.params.id         — Session ObjectId
 * @bodyparam {string} questionId          — The question being answered
 * @bodyparam {string} text                — The user's answer text
 *
 * @returns {object} 200 — { success: true, message, questionId, submittedAt }
 * @returns {object} 400 — invalid session/question ID or session already completed
 * @returns {object} 403 — session belongs to a different user
 * @returns {object} 404 — session not found
 */
const submitAnswer = async (req, res) => {
  const { id: sessionId } = req.params;
  const userId = req.user._id;

  // 1. Validate session ID format
  if (!isValidObjectId(sessionId)) {
    return res.status(400).json({
      success: false,
      message: `Invalid session ID format: '${sessionId}'.`,
    });
  }

  // 2. Validate request body
  if (handleValidationErrors(req, res)) return;

  const { questionId, text } = req.body;

  // 3. Find the session
  const session = await Session.findById(sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: `No session found with ID: ${sessionId}`,
    });
  }

  // 4. Ownership check — a user must NEVER be able to submit answers to
  //    someone else's session. Using .toString() for comparison because
  //    Mongoose ObjectIds are objects and === would compare references.
  if (session.userId.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. This session belongs to another user.',
    });
  }

  // 5. Status check — reject submissions to already-completed sessions
  if (session.status !== 'active') {
    return res.status(400).json({
      success: false,
      message: 'Cannot submit answers to a completed session.',
    });
  }

  // 6. Verify the questionId is actually part of this session's question set.
  //    Without this check, a user could inject arbitrary questionIds into a
  //    session, creating orphaned answer entries that don't match any presented
  //    question.
  const questionBelongsToSession = session.questions.some(
    (qId) => qId.toString() === questionId,
  );

  if (!questionBelongsToSession) {
    return res.status(400).json({
      success: false,
      message: `Question ${questionId} is not part of this session.`,
    });
  }

  // 7. Find existing answer entry or push a new one
  const submittedAt = new Date();
  const existingAnswerIndex = session.answers.findIndex(
    (answer) => answer.questionId.toString() === questionId,
  );

  if (existingAnswerIndex !== -1) {
    // Update existing entry — the user may refine their answer before submitting
    session.answers[existingAnswerIndex].text = text;
    session.answers[existingAnswerIndex].submittedAt = submittedAt;
  } else {
    // Push new entry — this handles cases where the pre-populated empty answer
    // was somehow missing (e.g., data inconsistency)
    session.answers.push({
      questionId,
      text,
      submittedAt,
    });
  }

  await session.save();

  // 8. Return lightweight confirmation — deliberately not returning the full
  //    session object because this endpoint gets called on every answer save
  //    and sending the full session with all questions/answers would waste
  //    bandwidth and processing time.
  res.status(200).json({
    success: true,
    message: 'Answer submitted successfully.',
    questionId,
    submittedAt,
  });
};

/**
 * @desc    Mark an active session as completed. Validates session ownership,
 *          status, and applies a timing check to prevent users from skipping
 *          the interview by calling this endpoint immediately after starting.
 *          Actual AI scoring is handled by a separate endpoint (built later) —
 *          this endpoint only transitions the session status.
 * @route   POST /api/sessions/:id/complete
 * @access  Protected (any authenticated user)
 *
 * @param   {string} req.params.id — Session ObjectId
 *
 * @returns {object} 200 — { success: true, message, sessionId, endTime }
 * @returns {object} 400 — invalid ID, session already completed, or timing violation
 * @returns {object} 403 — session belongs to a different user
 * @returns {object} 404 — session not found
 */
const completeSession = async (req, res) => {
  const { id: sessionId } = req.params;
  const userId = req.user._id;

  // 1. Validate session ID format
  if (!isValidObjectId(sessionId)) {
    return res.status(400).json({
      success: false,
      message: `Invalid session ID format: '${sessionId}'.`,
    });
  }

  // 2. Find and populate the session to access question timeLimits
  const session = await Session.findById(sessionId).populate(
    'questions',
    'timeLimit',
  );

  if (!session) {
    return res.status(404).json({
      success: false,
      message: `No session found with ID: ${sessionId}`,
    });
  }

  // 3. Ownership check
  if (session.userId.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. This session belongs to another user.',
    });
  }

  // 4. Status check
  if (session.status !== 'active') {
    return res.status(400).json({
      success: false,
      message: 'This session is already completed.',
    });
  }

  // 5. CRITICAL: Timing validation
  //    Why: Without this check, a user could start a session and immediately
  //    call /complete to skip the interview entirely. This would allow gaming
  //    the system — starting and completing sessions instantly to farm attempts
  //    or manipulate history. We enforce two constraints:
  //
  //    a) MINIMUM elapsed time: The user must have spent at least 30 seconds
  //       in the session. This is a generous lower bound — even the fastest
  //       reader cannot meaningfully engage with interview questions in under
  //       30 seconds. This catches instant-complete exploits.
  //
  //    b) MAXIMUM elapsed time: The total elapsed time must not exceed the
  //       totalAllowedTime + a 10-second buffer. The buffer accounts for
  //       network latency between the frontend timer expiring and the
  //       complete request arriving at the server. If elapsed time exceeds
  //       this, the session should have been auto-completed already, and
  //       this late request is suspicious (possible clock manipulation).
  const elapsedMs = Date.now() - session.startTime.getTime();
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  const MINIMUM_SESSION_SECONDS = 30;
  const TIMING_BUFFER_SECONDS = 10;

  const totalAllowedTimeMs = await calculateTotalAllowedTime(session.questions);
  const totalAllowedTimeSeconds = Math.floor(totalAllowedTimeMs / 1000);

  if (elapsedSeconds < MINIMUM_SESSION_SECONDS) {
    return res.status(400).json({
      success: false,
      message: `Session cannot be completed so quickly. You have only spent ${elapsedSeconds} seconds. Minimum required: ${MINIMUM_SESSION_SECONDS} seconds.`,
    });
  }

  if (elapsedSeconds > totalAllowedTimeSeconds + TIMING_BUFFER_SECONDS) {
    // Instead of rejecting, we still allow completion but note the overage.
    // Why: The user may have legitimate network issues that delayed the request.
    // Rejecting would be a poor UX. We log a warning and proceed.
    console.warn(
      `⚠️  Session ${sessionId} completed ${elapsedSeconds - totalAllowedTimeSeconds}s past the allowed time. Possible clock drift or network delay.`,
    );
  }

  // 6. Mark session as completed
  session.status = 'completed';
  session.endTime = new Date();
  await session.save();

  res.status(200).json({
    success: true,
    message: 'Session completed successfully. AI evaluation will be available separately.',
    sessionId: session._id,
    endTime: session.endTime,
  });
};

/**
 * @desc    Retrieve completed session history for the logged-in user, sorted
 *          by most recent first. Returns only summary fields (not full
 *          question/answer details) to keep the response lightweight for a
 *          history list view.
 * @route   GET /api/sessions/history
 * @access  Protected (any authenticated user)
 *
 * @returns {object} 200 — { success: true, count, sessions: SessionSummary[] }
 *          where SessionSummary = { _id, company, type, totalScore, endTime, questionCount }
 */
const getSessionHistory = async (req, res) => {
  const userId = req.user._id;

  // Use aggregation to return only summary fields and compute questionCount
  // from the questions array length. This avoids sending full question/answer
  // data over the wire for what is essentially a list view.
  const sessions = await Session.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: 'completed',
      },
    },
    {
      $sort: { endTime: -1 },
    },
    {
      $project: {
        company: 1,
        type: 1,
        totalScore: 1,
        endTime: 1,
        startTime: 1,
        // $size computes the array length server-side so we don't transfer
        // the full questions array just to count it on the client.
        questionCount: { $size: '$questions' },
        answeredCount: {
          // Count only answers that have a submittedAt timestamp, meaning
          // the user actually typed and submitted a response.
          $size: {
            $filter: {
              input: '$answers',
              as: 'answer',
              cond: { $ne: ['$$answer.submittedAt', null] },
            },
          },
        },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    count: sessions.length,
    sessions,
  });
};

// =============================================================================
// Internal Helper
// =============================================================================

/**
 * Calculates the total allowed time for a session in milliseconds by summing
 * the timeLimit of each question. Falls back to 300 seconds per question if
 * the field is missing (e.g., questions populated with only select fields).
 *
 * @param {Array} questions - Array of question documents or populated refs
 * @returns {Promise<number>} Total allowed time in milliseconds
 */
const calculateTotalAllowedTime = async (questions) => {
  let totalSeconds = 0;

  for (const question of questions) {
    // If the question is a populated document, read timeLimit directly.
    // If it's just an ObjectId (not populated), fall back to the default.
    if (question && typeof question === 'object' && question.timeLimit) {
      totalSeconds += question.timeLimit;
    } else {
      // Default 300s (5 minutes) per question when timeLimit is not available.
      // This matches the Question model's default value.
      totalSeconds += 300;
    }
  }

  return totalSeconds * 1000;
};

/**
 * @desc    Trigger AI evaluation for all answers in a completed session.
 *          Checks for existing feedback to prevent duplicate API costs.
 *          Evaluates each answer SEQUENTIALLY (not in parallel) and saves
 *          individual Feedback documents. Calculates and stores the average
 *          score on the Session document.
 * @route   POST /api/sessions/:id/evaluate
 * @access  Protected (any authenticated user)
 *
 * @param   {string} req.params.id — Session ObjectId
 *
 * @returns {object} 200 — existing feedback if already evaluated
 * @returns {object} 200 — { success, message, evaluatedCount, totalScore, feedback }
 * @returns {object} 400 — invalid ID or session not yet completed
 * @returns {object} 403 — session belongs to a different user
 * @returns {object} 404 — session not found
 */
const evaluateSession = async (req, res) => {
  const { id: sessionId } = req.params;
  const userId = req.user._id;

  // 1. Validate session ID format
  if (!isValidObjectId(sessionId)) {
    return res.status(400).json({
      success: false,
      message: `Invalid session ID format: '${sessionId}'.`,
    });
  }

  // 2. Find the session
  const session = await Session.findById(sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: `No session found with ID: ${sessionId}`,
    });
  }

  // 3. Ownership check
  if (session.userId.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. This session belongs to another user.',
    });
  }

  // 4. Status check — must be completed before evaluation can begin.
  //    Why: Evaluating an active session would produce incomplete results
  //    because the student may still be typing answers.
  if (session.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Session must be completed before evaluation. Call the /complete endpoint first.',
    });
  }

  // 5. Check if feedback already exists for this session.
  //    Why: Prevents duplicate AI API calls which cost real money. If the
  //    user or frontend calls /evaluate again (e.g., page refresh), we
  //    return the existing results instead of re-running the AI pipeline.
  const existingFeedback = await Feedback.find({ sessionId }).sort({ createdAt: 1 });

  if (existingFeedback.length > 0) {
    return res.status(200).json({
      success: true,
      message: 'This session has already been evaluated. Returning existing results.',
      evaluatedCount: existingFeedback.length,
      totalScore: session.totalScore,
      feedback: existingFeedback,
    });
  }

  // 6. Evaluate each answer sequentially.
  //    Why sequential (for...of) instead of Promise.all:
  //    a) Rate limiting — Anthropic enforces request-per-minute limits.
  //       Firing 10 requests simultaneously risks hitting the rate limit
  //       and failing most of them.
  //    b) Cost predictability — if the 3rd call fails, we have results for
  //       questions 1-2 saved and can log exactly which question failed.
  //       With Promise.all, a single failure could cause a confusing partial
  //       state or require complex retry logic.
  //    c) Debugging — sequential execution produces a clear, ordered log
  //       of which evaluations succeeded and which failed.
  const feedbackResults = [];
  const scores = [];

  for (const answer of session.answers) {
    // Fetch the full question document to get keyPoints and text.
    // Why we fetch inside the loop rather than bulk-loading: Each question
    // might have been deleted since the session was created. Fetching
    // individually lets us handle missing questions gracefully per-answer.
    const question = await Question.findById(answer.questionId);

    let evaluationResult;

    if (!question) {
      // Question was deleted after the session was created — rare but possible
      console.warn(
        `⚠️  Question ${answer.questionId} not found during evaluation of session ${sessionId}. Skipping AI call.`,
      );
      evaluationResult = {
        score: 0,
        missingPoints: [],
        positives: [],
        tip: 'This question is no longer available in the question bank.',
        modelAnswer: '',
        evaluationFailed: true,
      };
    } else {
      // Call the AI service — this function never throws, always returns
      // a usable result object (see aiService.js documentation).
      evaluationResult = await aiService.evaluateAnswer(
        question.text,
        question.keyPoints,
        answer.text,
      );
    }

    // Save the Feedback document regardless of success or failure.
    // The evaluationFailed flag tells the frontend whether to trust the score.
    const feedbackDoc = await Feedback.create({
      sessionId,
      questionId: answer.questionId,
      userId,
      score: evaluationResult.score,
      missingPoints: evaluationResult.missingPoints,
      positives: evaluationResult.positives,
      tip: evaluationResult.tip,
      modelAnswer: evaluationResult.modelAnswer,
      evaluationFailed: evaluationResult.evaluationFailed || false,
    });

    feedbackResults.push(feedbackDoc);
    scores.push(evaluationResult.score);
  }

  // 7. Calculate the average score across all answers.
  //    Round to 1 decimal place for clean display (e.g., 7.3 not 7.333333).
  const totalScore = scores.length > 0
    ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
    : 0;

  // 8. Update the session with the computed total score
  session.totalScore = totalScore;
  await session.save();

  res.status(200).json({
    success: true,
    message: `Evaluation complete. ${feedbackResults.length} answer(s) evaluated.`,
    evaluatedCount: feedbackResults.length,
    totalScore,
    feedback: feedbackResults,
  });
};

/**
 * @desc    Generate a full session report combining question details, the
 *          student's submitted answers, and AI feedback into a single
 *          response. Designed for the detailed report view after evaluation.
 * @route   GET /api/sessions/:id/report
 * @access  Protected (any authenticated user)
 *
 * @param   {string} req.params.id — Session ObjectId
 *
 * @returns {object} 200 — { success, totalScore, company, type, startTime,
 *                          endTime, questions: CombinedQuestionReport[] }
 * @returns {object} 400 — invalid ID or session not yet completed
 * @returns {object} 403 — session belongs to a different user
 * @returns {object} 404 — session not found
 */
const getSessionReport = async (req, res) => {
  const { id: sessionId } = req.params;
  const userId = req.user._id;

  // 1. Validate session ID format
  if (!isValidObjectId(sessionId)) {
    return res.status(400).json({
      success: false,
      message: `Invalid session ID format: '${sessionId}'.`,
    });
  }

  // 2. Find the session with populated question details.
  //    Only populate frontend-safe fields — keyPoints and modelAnswer come
  //    from the Feedback model (which has the AI-generated model answer),
  //    not from the Question model directly.
  const session = await Session.findById(sessionId).populate(
    'questions',
    'text company type difficulty topic',
  );

  if (!session) {
    return res.status(404).json({
      success: false,
      message: `No session found with ID: ${sessionId}`,
    });
  }

  // 3. Ownership check
  if (session.userId.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. This session belongs to another user.',
    });
  }

  // 4. Status check
  if (session.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Report is only available for completed sessions.',
    });
  }

  // 5. Fetch all feedback documents for this session.
  //    We index on sessionId so this query is efficient.
  const feedbackDocs = await Feedback.find({ sessionId });

  // Build a lookup map keyed by questionId string for O(1) access when
  // combining with questions. This avoids nested loops (O(n*m)) when
  // matching feedback to questions.
  const feedbackMap = new Map();
  for (const fb of feedbackDocs) {
    feedbackMap.set(fb.questionId.toString(), fb);
  }

  // 6. Combine questions + answers + feedback in original question order.
  //    Why we preserve original order: The report should mirror the sequence
  //    the student experienced during the interview for intuitive review.
  const questionsReport = session.questions.map((question) => {
    const questionIdStr = question._id.toString();

    // Find the student's answer for this question
    const answerEntry = session.answers.find(
      (a) => a.questionId.toString() === questionIdStr,
    );

    // Find the AI feedback for this question
    const feedback = feedbackMap.get(questionIdStr);

    // Build a combined report object for this question
    const reportItem = {
      questionId: question._id,
      text: question.text,
      company: question.company,
      type: question.type,
      difficulty: question.difficulty,
      topic: question.topic,
      studentAnswer: answerEntry ? answerEntry.text : '',
      submittedAt: answerEntry ? answerEntry.submittedAt : null,
    };

    if (feedback) {
      // Evaluation ran — include AI feedback
      reportItem.score = feedback.score;
      reportItem.missingPoints = feedback.missingPoints;
      reportItem.positives = feedback.positives;
      reportItem.tip = feedback.tip;
      reportItem.modelAnswer = feedback.modelAnswer;
      reportItem.evaluationFailed = feedback.evaluationFailed;
    } else {
      // Evaluation has not been run yet for this question.
      // This happens if the user views the report before calling /evaluate,
      // or if evaluation was interrupted partway through.
      reportItem.score = null;
      reportItem.missingPoints = null;
      reportItem.positives = null;
      reportItem.tip = null;
      reportItem.modelAnswer = null;
      reportItem.evaluationFailed = null;
      reportItem.evaluationPending = true;
    }

    return reportItem;
  });

  res.status(200).json({
    success: true,
    totalScore: session.totalScore,
    company: session.company,
    type: session.type,
    startTime: session.startTime,
    endTime: session.endTime,
    questionCount: questionsReport.length,
    questions: questionsReport,
  });
};

module.exports = {
  startSession,
  startSessionValidation,
  getActiveSession,
  submitAnswer,
  submitAnswerValidation,
  completeSession,
  getSessionHistory,
  evaluateSession,
  getSessionReport,
};
