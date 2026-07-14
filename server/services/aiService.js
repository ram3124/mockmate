const OpenAI = require('openai');

// =============================================================================
// OpenRouter Client
// =============================================================================
// OpenRouter exposes an OpenAI-compatible API, so we use the official openai
// npm package but point it at OpenRouter's base URL instead of OpenAI's.
// This means we can swap models freely (open-source, Claude, Gemini, etc.)
// without changing any of the calling code — only the model string changes.
// =============================================================================
const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  // Why defaultHeaders: OpenRouter uses these headers for usage tracking
  // and to identify your app in their dashboard. Neither is required for
  // the API to work, but they're good practice and help with debugging.
  defaultHeaders: {
    'HTTP-Referer': process.env.SERVER_URL || 'http://localhost:5000',
    'X-Title': 'MockMate',
  },
});

// Why google/gemini-2.0-flash-exp:free:
// It's available on OpenRouter's free tier (no billing required), handles
// structured JSON output reliably, and is fast enough for sequential
// per-question evaluation. The ":free" suffix selects the free rate-limited
// variant — swap to a paid model string when you want higher throughput.

const MODEL = "openai/gpt-4.1-mini";
console.log("Using model:", MODEL);

// =============================================================================
// Fallback object factory
// =============================================================================

/**
 * Creates a standardised fallback evaluation result used when the AI call
 * fails or the student submitted an empty answer. This ensures the caller
 * always receives a consistent object shape regardless of success or failure.
 *
 * @param {string} tip - A human-readable explanation of why evaluation failed
 * @returns {object} A Feedback-compatible evaluation result with evaluationFailed: true
 */
const createFallbackResult = (tip) => ({
  score: 0,
  missingPoints: [],
  positives: [],
  tip: tip || 'Evaluation could not be completed for this answer.',
  // Non-empty string required — Feedback model has modelAnswer: required: true
  // An empty string would fail Mongoose validation even inside a fallback path
  modelAnswer: 'No model answer available — evaluation could not be completed.',
  evaluationFailed: true,
});

// =============================================================================
// JSON Response Cleaner
// =============================================================================

/**
 * Strips markdown code fences from a string before JSON parsing. Despite
 * explicit instructions to return raw JSON, LLMs sometimes wrap responses
 * in triple backticks. This function removes those fences so JSON.parse()
 * can succeed.
 *
 * @param {string} text - Raw text from the AI response
 * @returns {string} Cleaned text ready for JSON.parse()
 */
const stripCodeFences = (text) => {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.trim();

  // Remove opening fence: ```json or ``` at the start
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');

  // Remove closing fence: ``` at the end
  cleaned = cleaned.replace(/\n?\s*```\s*$/i, '');

  return cleaned.trim();
};

// =============================================================================
// Core Evaluation Function
// =============================================================================

/**
 * Evaluates a student's answer against a question and its key evaluation
 * points using OpenRouter's AI API. This function is designed to NEVER
 * throw — it always returns a usable object, even on failure.
 *
 * @param {string}   questionText  - The interview question that was asked
 * @param {string[]} keyPoints     - Array of evaluation criteria the answer should cover
 * @param {string}   studentAnswer - The student's submitted answer text
 *
 * @returns {Promise<object>} Evaluation result with shape:
 *   { score, missingPoints, positives, tip, modelAnswer, evaluationFailed? }
 *   - On success: evaluationFailed is false (or absent)
 *   - On failure: evaluationFailed is true, score is 0
 */
const evaluateAnswer = async (questionText, keyPoints, studentAnswer) => {
  // ── Guard: Skip AI call for empty or whitespace-only answers ──────────
  // Why: Sending empty text to the AI wastes an API call. We already know
  // the score is 0 and can return immediate feedback without any inference.
  if (!studentAnswer || studentAnswer.trim().length === 0) {
    return createFallbackResult(
      'No answer was submitted for this question. Make sure to type your response before the time runs out.',
    );
  }

  try {
    // ── Build the prompt ─────────────────────────────────────────────────
    // Format keyPoints as a numbered list for clarity in the prompt
    const keyPointsList = keyPoints
      .map((point, index) => `${index + 1}. ${point}`)
      .join('\n');

    // Why separate system + user messages:
    // System message sets the persona and strict output format rules.
    // User message provides the actual question content per evaluation.
    // This separation gives the model clearer role boundaries and tends
    // to produce more consistent JSON adherence than a single combined prompt.
    const systemMessage = `You are an expert technical interviewer evaluating a candidate's answer.

CRITICAL INSTRUCTIONS:
- Return ONLY valid JSON. No markdown code fences. No explanation text before or after the JSON.
- Do NOT wrap the JSON in \`\`\` or \`\`\`json blocks.
- Your entire response must be parseable by JSON.parse() directly.

The JSON must have this exact structure:
{
  "score": <number from 0 to 10>,
  "missingPoints": [<array of strings — key concepts the candidate missed>],
  "positives": [<array of strings — things the candidate explained well>],
  "tip": "<a single constructive sentence of advice for improvement>",
  "modelAnswer": "<a concise ideal answer in 3-5 sentences>"
}

Scoring guidelines:
- 0-2: Answer is wrong, irrelevant, or demonstrates no understanding
- 3-4: Shows basic awareness but misses most key concepts
- 5-6: Covers some key points but lacks depth or has inaccuracies
- 7-8: Good answer covering most key points with reasonable depth
- 9-10: Excellent answer demonstrating deep understanding of all key concepts`;

    const userMessage = `QUESTION:
${questionText}

KEY EVALUATION POINTS (the candidate should ideally cover these):
${keyPointsList}

CANDIDATE'S ANSWER:
${studentAnswer}

Evaluate the candidate's answer against the key points and return the JSON evaluation.`;

    // ── Call the OpenRouter API ──────────────────────────────────────────
    const completion = await client.chat.completions.create({
      model: MODEL,
      // Why 700 max_tokens: The structured JSON response typically runs
      // 200-400 tokens. 700 gives comfortable headroom for longer
      // modelAnswer fields without allowing runaway generation.
      max_tokens: 700,
      // Why temperature 0.3: We want deterministic, consistent scoring.
      // High temperatures would cause the same answer to receive different
      // scores on re-evaluation, undermining user trust in the system.
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
    });

    // ── Extract response text ────────────────────────────────────────────
    const rawResponseText = completion.choices?.[0]?.message?.content;

    if (!rawResponseText) {
      console.error('❌  OpenRouter response contained no text content.');
      console.error('    Full completion object:', JSON.stringify(completion, null, 2));
      return createFallbackResult(
        'AI evaluation returned an empty response. Please try evaluating again.',
      );
    }

    // Strip any accidental code fences before parsing
    const cleanedText = stripCodeFences(rawResponseText);

    // ── Parse JSON response ──────────────────────────────────────────────
    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('❌  Failed to parse AI response as JSON:', parseError.message);
      console.error('    Raw response was:', rawResponseText.substring(0, 500));
      return createFallbackResult(
        'AI evaluation response could not be parsed. Please try evaluating again.',
      );
    }

    // ── Validate the parsed result has the expected shape ────────────────
    // Why explicit field-by-field validation: The model might return valid
    // JSON but with wrong field names or wrong types. We sanitise every field
    // so the Feedback model always receives clean, schema-compatible data.
    const validatedResult = {
      score:
        typeof parsedResult.score === 'number'
          ? Math.min(10, Math.max(0, Math.round(parsedResult.score * 10) / 10))
          : 0,
      missingPoints: Array.isArray(parsedResult.missingPoints)
        ? parsedResult.missingPoints.filter((item) => typeof item === 'string')
        : [],
      positives: Array.isArray(parsedResult.positives)
        ? parsedResult.positives.filter((item) => typeof item === 'string')
        : [],
      tip:
        typeof parsedResult.tip === 'string' && parsedResult.tip.length > 0
          ? parsedResult.tip
          : 'Review the model answer and key points to strengthen your response.',
      modelAnswer:
        typeof parsedResult.modelAnswer === 'string' && parsedResult.modelAnswer.length > 0
          ? parsedResult.modelAnswer
          : 'No model answer available — evaluation could not be completed.',
      evaluationFailed: false,
    };

    return validatedResult;

  } catch (apiError) {
    // ── Handle any API-level error (network, auth, rate limit, etc.) ────
    // Why catch-and-return instead of re-throwing: The controller processes
    // multiple answers in a sequential loop. If one AI call fails, we save
    // a "failed" Feedback record and continue evaluating remaining answers
    // rather than aborting the entire batch. This is why the service layer
    // must never propagate errors upward.
    console.error('❌  OpenRouter API call failed:', apiError.message);

    // Log the status code if available for easier debugging
    if (apiError.status) {
      console.error('    HTTP status:', apiError.status);
    }

    // ── Specific error messages for common failure modes ─────────────────

    // 401 — invalid or missing API key
    if (apiError.status === 401 || (apiError.message && apiError.message.includes('401'))) {
      return createFallbackResult(
        'AI evaluation failed due to an authentication error. Please check the OPENROUTER_API_KEY in your .env file.',
      );
    }

    // 402 — out of credits on OpenRouter
    if (apiError.status === 402 || (apiError.message && apiError.message.includes('402'))) {
      return createFallbackResult(
        'AI evaluation failed — OpenRouter account has insufficient credits. Add credits at openrouter.ai/credits.',
      );
    }

    // 429 — rate limited
    if (apiError.status === 429 || (apiError.message && apiError.message.includes('429'))) {
      return createFallbackResult(
        'AI evaluation was rate-limited. Please wait a moment and try evaluating again.',
      );
    }

    // 503 — model or service temporarily unavailable
    if (apiError.status === 503 || (apiError.message && apiError.message.includes('503'))) {
      return createFallbackResult(
        'AI service is temporarily unavailable. Please try evaluating again in a few minutes.',
      );
    }

    return createFallbackResult(
      'AI evaluation encountered an unexpected error. Please try evaluating again.',
    );
  }
};

module.exports = {
  evaluateAnswer,
};