const mongoose = require('mongoose');
const { body, query, validationResult } = require('express-validator');
const Question = require('../models/Question');

// -----------------------------------------------------------------------------
// Enum references — pulled from the model's static helpers so that if enum
// values change in the schema, the controller automatically stays in sync.
// -----------------------------------------------------------------------------
const ALLOWED_COMPANIES = Question.getAllowedCompanies();
const ALLOWED_TYPES = Question.getAllowedTypes();
const ALLOWED_DIFFICULTIES = Question.getAllowedDifficulties();

// ─── Helper: Check validation result and return 400 if invalid ───────────────
/**
 * Inspects the express-validator validation chain result. If there are errors,
 * sends a 400 response with the list of problems and returns `true` so the
 * caller knows to stop processing. Returns `false` when there are no errors.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {boolean} `true` if response was sent (validation failed).
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

// ─── Helper: Validate MongoDB ObjectId ───────────────────────────────────────
/**
 * Checks whether a given string is a valid MongoDB ObjectId. We validate early
 * to avoid passing garbage IDs into Mongoose queries, which can throw
 * CastErrors or return confusing results.
 *
 * @param {string} id - The string to validate.
 * @returns {boolean} `true` if it is a valid 24-hex-char ObjectId.
 */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// =============================================================================
// Validation Chains — exported as route-level middleware arrays
// =============================================================================

/** Validation rules for creating a new question (all fields required). */
const createQuestionValidation = [
  body('text')
    .trim()
    .notEmpty().withMessage('Question text is required')
    .isLength({ min: 10 }).withMessage('Question text must be at least 10 characters'),

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

  body('difficulty')
    .optional()
    .trim()
    .isIn(ALLOWED_DIFFICULTIES)
    .withMessage(`Difficulty must be one of: ${ALLOWED_DIFFICULTIES.join(', ')}`),

  body('topic')
    .trim()
    .notEmpty().withMessage('Topic is required'),

  body('keyPoints')
    .isArray({ min: 1 }).withMessage('keyPoints must be an array with at least 1 item'),

  body('keyPoints.*')
    .isString().withMessage('Each key point must be a string')
    .trim()
    .notEmpty().withMessage('Key points cannot be empty strings'),

  body('modelAnswer')
    .trim()
    .notEmpty().withMessage('Model answer is required')
    .isLength({ min: 20 }).withMessage('Model answer must be at least 20 characters'),

  body('timeLimit')
    .optional()
    .isInt({ min: 60, max: 1800 })
    .withMessage('timeLimit must be an integer between 60 and 1800 seconds'),
];

/**
 * Validation rules for updating an existing question.
 * Identical to create rules but every field is optional because we allow
 * partial updates — the client may send only the fields it wants to change.
 */
const updateQuestionValidation = [
  body('text')
    .optional()
    .trim()
    .isLength({ min: 10 }).withMessage('Question text must be at least 10 characters'),

  body('company')
    .optional()
    .trim()
    .isIn(ALLOWED_COMPANIES)
    .withMessage(`Company must be one of: ${ALLOWED_COMPANIES.join(', ')}`),

  body('type')
    .optional()
    .trim()
    .isIn(ALLOWED_TYPES)
    .withMessage(`Type must be one of: ${ALLOWED_TYPES.join(', ')}`),

  body('difficulty')
    .optional()
    .trim()
    .isIn(ALLOWED_DIFFICULTIES)
    .withMessage(`Difficulty must be one of: ${ALLOWED_DIFFICULTIES.join(', ')}`),

  body('topic')
    .optional()
    .trim()
    .notEmpty().withMessage('Topic cannot be empty if provided'),

  body('keyPoints')
    .optional()
    .isArray({ min: 1 }).withMessage('keyPoints must be an array with at least 1 item'),

  body('keyPoints.*')
    .optional()
    .isString().withMessage('Each key point must be a string')
    .trim()
    .notEmpty().withMessage('Key points cannot be empty strings'),

  body('modelAnswer')
    .optional()
    .trim()
    .isLength({ min: 20 }).withMessage('Model answer must be at least 20 characters'),

  body('timeLimit')
    .optional()
    .isInt({ min: 60, max: 1800 })
    .withMessage('timeLimit must be an integer between 60 and 1800 seconds'),
];

/** Validation rules for GET /api/questions query parameters. */
const getQuestionsQueryValidation = [
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

  query('difficulty')
    .optional()
    .trim()
    .isIn(ALLOWED_DIFFICULTIES)
    .withMessage(`Invalid difficulty filter. Allowed: ${ALLOWED_DIFFICULTIES.join(', ')}`),

  query('count')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('count must be an integer between 1 and 20'),
];

// =============================================================================
// Controller Functions
// =============================================================================

/**
 * @desc    Retrieve a random sample of questions, optionally filtered by
 *          company, type, and/or difficulty.
 * @route   GET /api/questions
 * @access  Protected (any authenticated user)
 *
 * @queryparam {string}  [company]    - Filter by company (must be in ALLOWED_COMPANIES)
 * @queryparam {string}  [type]       - Filter by question type (must be in ALLOWED_TYPES)
 * @queryparam {string}  [difficulty] - Filter by difficulty (must be in ALLOWED_DIFFICULTIES)
 * @queryparam {number}  [count=10]   - Number of questions to return (1–20, default 10)
 *
 * @returns {object} 200 — { success: true, totalMatched: number, count: number, questions: Question[] }
 * @returns {object} 400 — if any query param fails enum validation
 */
const getQuestions = async (req, res) => {
  // 1. Validate query params against enum values before touching the database
  if (handleValidationErrors(req, res)) return;

  // 2. Build the $match filter from validated query params
  const matchFilter = {};
  if (req.query.company) matchFilter.company = req.query.company;
  if (req.query.type) matchFilter.type = req.query.type;
  if (req.query.difficulty) matchFilter.difficulty = req.query.difficulty;

  // 3. Determine sample size — default 10, capped at 20 to prevent
  //    clients from requesting the entire collection in one call.
  const requestedCount = parseInt(req.query.count, 10);
  const sampleSize = Number.isNaN(requestedCount)
    ? 10
    : Math.min(Math.max(requestedCount, 1), 20);

  // 4. Count total documents matching the filter *before* sampling.
  //    This gives the client context on how many questions exist for the
  //    chosen filter, even though only `sampleSize` are returned.
  const totalMatched = await Question.countDocuments(matchFilter);

  // 5. Aggregation pipeline: $match MUST come before $sample.
  //    Why: $sample picks N random documents from the *entire* collection.
  //    If we sampled first, we'd randomly pick N docs and then filter them,
  //    which could return fewer (or zero) results even when matching docs exist.
  //    By matching first we narrow the pool, then sample from the matches.
  const pipeline = [];

  // Only add $match stage if there are filter criteria — an empty $match
  // would scan the full collection which is wasteful.
  if (Object.keys(matchFilter).length > 0) {
    pipeline.push({ $match: matchFilter });
  }

  pipeline.push({ $sample: { size: sampleSize } });

  const questions = await Question.aggregate(pipeline);

  res.status(200).json({
    success: true,
    totalMatched,
    count: questions.length,
    questions,
  });
};

/**
 * @desc    Retrieve a single question by its MongoDB ObjectId.
 * @route   GET /api/questions/:id
 * @access  Protected (any authenticated user)
 *
 * @param   {string} req.params.id - The MongoDB ObjectId of the question.
 *
 * @returns {object} 200 — { success: true, question: Question }
 * @returns {object} 400 — if the id is not a valid ObjectId format
 * @returns {object} 404 — if no question exists with that id
 */
const getQuestionById = async (req, res) => {
  const { id } = req.params;

  // 1. Validate ObjectId format early to avoid a Mongoose CastError
  if (!isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: `Invalid question ID format: '${id}'. Must be a 24-character hex string.`,
    });
  }

  // 2. Query the database
  const question = await Question.findById(id);

  if (!question) {
    return res.status(404).json({
      success: false,
      message: `No question found with ID: ${id}`,
    });
  }

  res.status(200).json({
    success: true,
    question,
  });
};

/**
 * @desc    Create a new question in the bank. Only admins can add questions.
 *          Automatically stamps the `createdBy` field with the authenticated
 *          user's ID from the JWT.
 * @route   POST /api/questions
 * @access  Protected + Admin only
 *
 * @bodyparam {string}   text       - The question text (min 10 chars)
 * @bodyparam {string}   company    - One of ALLOWED_COMPANIES
 * @bodyparam {string}   type       - One of ALLOWED_TYPES
 * @bodyparam {string}   [difficulty='Medium'] - One of ALLOWED_DIFFICULTIES
 * @bodyparam {string}   topic      - Topic tag (e.g. 'Arrays', 'OS')
 * @bodyparam {string[]} keyPoints  - At least 1 evaluation criterion
 * @bodyparam {string}   modelAnswer - Reference answer (min 20 chars)
 * @bodyparam {number}   [timeLimit=300] - Seconds allowed (60–1800)
 *
 * @returns {object} 201 — { success: true, question: Question }
 * @returns {object} 400 — if validation fails on any field
 */
const createQuestion = async (req, res) => {
  // 1. Check express-validator results
  if (handleValidationErrors(req, res)) return;

  const {
    text,
    company,
    type,
    difficulty,
    topic,
    keyPoints,
    modelAnswer,
    timeLimit,
  } = req.body;

  // 2. Build the question document.
  //    `createdBy` is set from the authenticated user attached by the auth
  //    middleware — the client cannot override this field.
  const questionData = {
    text,
    company,
    type,
    difficulty,
    topic,
    keyPoints,
    modelAnswer,
    timeLimit,
    createdBy: req.user._id,
  };

  const question = await Question.create(questionData);

  res.status(201).json({
    success: true,
    question,
  });
};

/**
 * @desc    Update an existing question by ID. Only admins can update.
 *          Supports partial updates — only the fields sent in the body
 *          are modified; omitted fields remain unchanged.
 * @route   PUT /api/questions/:id
 * @access  Protected + Admin only
 *
 * @param   {string} req.params.id - The MongoDB ObjectId of the question.
 * @bodyparam {string}   [text]        - Updated question text
 * @bodyparam {string}   [company]     - Updated company
 * @bodyparam {string}   [type]        - Updated question type
 * @bodyparam {string}   [difficulty]  - Updated difficulty
 * @bodyparam {string}   [topic]       - Updated topic tag
 * @bodyparam {string[]} [keyPoints]   - Updated evaluation criteria
 * @bodyparam {string}   [modelAnswer] - Updated reference answer
 * @bodyparam {number}   [timeLimit]   - Updated time limit
 *
 * @returns {object} 200 — { success: true, question: Question }
 * @returns {object} 400 — if the id is invalid or validation fails
 * @returns {object} 404 — if no question exists with that id
 */
const updateQuestion = async (req, res) => {
  const { id } = req.params;

  // 1. Validate ObjectId format
  if (!isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: `Invalid question ID format: '${id}'. Must be a 24-character hex string.`,
    });
  }

  // 2. Check express-validator results for body fields
  if (handleValidationErrors(req, res)) return;

  // 3. Use findByIdAndUpdate with runValidators so that Mongoose schema
  //    validations (enums, minlength, etc.) still apply on updates.
  //    `new: true` returns the modified document instead of the original.
  const updatedQuestion = await Question.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!updatedQuestion) {
    return res.status(404).json({
      success: false,
      message: `No question found with ID: ${id}`,
    });
  }

  res.status(200).json({
    success: true,
    question: updatedQuestion,
  });
};

/**
 * @desc    Delete a question from the bank by ID. Only admins can delete.
 *          First verifies the question exists to provide a clear 404 if not,
 *          rather than silently "succeeding" on a non-existent document.
 * @route   DELETE /api/questions/:id
 * @access  Protected + Admin only
 *
 * @param   {string} req.params.id - The MongoDB ObjectId of the question.
 *
 * @returns {object} 200 — { success: true, message: 'Question deleted successfully', deletedId: string }
 * @returns {object} 400 — if the id is not a valid ObjectId format
 * @returns {object} 404 — if no question exists with that id
 */
const deleteQuestion = async (req, res) => {
  const { id } = req.params;

  // 1. Validate ObjectId format
  if (!isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: `Invalid question ID format: '${id}'. Must be a 24-character hex string.`,
    });
  }

  // 2. Check the question exists before deleting — findByIdAndDelete would
  //    return null for a missing doc but wouldn't distinguish "not found"
  //    from "already deleted". An explicit existence check provides a
  //    clear 404 to the client.
  const question = await Question.findById(id);

  if (!question) {
    return res.status(404).json({
      success: false,
      message: `No question found with ID: ${id}`,
    });
  }

  await Question.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Question deleted successfully',
    deletedId: id,
  });
};

module.exports = {
  getQuestions,
  getQuestionsQueryValidation,
  getQuestionById,
  createQuestion,
  createQuestionValidation,
  updateQuestion,
  updateQuestionValidation,
  deleteQuestion,
};
