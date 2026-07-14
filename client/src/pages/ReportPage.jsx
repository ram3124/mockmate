import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { evaluateSession, getSessionReport } from '../services/api';

// =============================================================================
// ReportPage — Post-Interview AI Feedback Report
// =============================================================================
// This page completes the Live Session flow. SessionPage.jsx navigates here
// once the user finishes (or the timer expires). The flow on mount is:
//
//   1. Call evaluateSession(sessionId) — triggers the backend's sequential
//      AI evaluation of every answer. This can take several seconds because
//      the backend deliberately evaluates one answer at a time (see
//      sessionController.js evaluateSession() comments — rate limiting and
//      cost predictability). If evaluation already ran (e.g. user refreshes
//      this page), the backend returns the existing results idempotently —
//      no special handling needed here, we just call it the same way either time.
//
//   2. Call getSessionReport(sessionId) — fetches the combined
//      question + studentAnswer + feedback array in original question order.
//
// Both calls happen in sequence on mount because the report endpoint requires
// feedback to already exist (or it returns evaluationPending: true per question).
// =============================================================================

// -----------------------------------------------------------------------------
// Helper: Extract readable error message from Axios error
// -----------------------------------------------------------------------------
// Matches the exact pattern used in SessionPage.jsx and HomePage.jsx so error
// messages behave consistently across the whole app.
function extractErrorMessage(err) {
  if (err.response?.data?.message) return err.response.data.message;
  if (err.response?.data?.error) return err.response.data.error;
  if (err.message) return err.message;
  return 'An unexpected error occurred. Please try again.';
}

// -----------------------------------------------------------------------------
// Difficulty badge color mapping — copied verbatim from SessionPage.jsx so
// badges look identical between the live interview and the report.
// -----------------------------------------------------------------------------
const DIFFICULTY_COLORS = {
  Easy: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  Medium: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  Hard: 'bg-red-500/15 text-red-300 border-red-500/20',
};

// -----------------------------------------------------------------------------
// Score color helper — used for the overall score and per-question score badges.
// Why these specific thresholds: >=7 is a strong answer (green), 4-6.9 is
// passable but has real gaps (amber), below 4 needs significant work (red).
// -----------------------------------------------------------------------------
function getScoreColorClasses(score) {
  if (score === null || score === undefined) {
    return 'bg-white/5 text-surface-200/40 border-white/10';
  }
  if (score >= 7) {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20';
  }
  if (score >= 4) {
    return 'bg-amber-500/15 text-amber-300 border-amber-500/20';
  }
  return 'bg-red-500/15 text-red-300 border-red-500/20';
}

function getScoreTextColor(score) {
  if (score === null || score === undefined) return 'text-surface-200/40';
  if (score >= 7) return 'text-emerald-400';
  if (score >= 4) return 'text-amber-400';
  return 'text-red-400';
}

// =============================================================================
// QuestionReportCard — one expandable entry per question in the report
// =============================================================================
// Why a separate component instead of inline JSX in the map(): Each card
// manages its own "show model answer" toggle state independently. If this
// were inline, all cards would need to share a single piece of state (e.g. an
// expandedIndex), which is more fragile — extracting state per-card here is
// simpler and avoids re-render coupling between unrelated questions.
// =============================================================================
function QuestionReportCard({ item, index }) {
  const [showModelAnswer, setShowModelAnswer] = useState(false);

  const hasAnswer = item.studentAnswer && item.studentAnswer.trim() !== '';

  return (
    <div
      className="glass-card rounded-2xl p-6 sm:p-7 animate-fade-in-up"
      style={{ animationDelay: `${0.05 * index}s` }}
    >
      {/* ── Question Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs font-medium text-surface-200/40">
              Question {index + 1}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                DIFFICULTY_COLORS[item.difficulty] || DIFFICULTY_COLORS.Medium
              }`}
            >
              {item.difficulty}
            </span>
            <span className="text-xs text-surface-200/40">{item.topic}</span>
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-white leading-relaxed">
            {item.text}
          </h3>
        </div>

        {/* Score badge — top right, matches the visual weight of a "result" */}
        <div
          className={`shrink-0 flex flex-col items-center justify-center rounded-xl border px-4 py-2.5 ${getScoreColorClasses(
            item.score,
          )}`}
        >
          <span className="text-2xl font-bold leading-none">
            {item.score !== null && item.score !== undefined ? item.score : '—'}
          </span>
          <span className="text-[10px] uppercase tracking-wider opacity-70 mt-0.5">
            / 10
          </span>
        </div>
      </div>

      {/* ── Evaluation Pending State ───────────────────────────────────── */}
      {/* Why this branch exists: the report endpoint returns
          evaluationPending: true for any question that has no Feedback
          document yet. This should be rare (evaluateSession runs first on
          this page), but it protects against the edge case where evaluation
          was interrupted partway through. */}
      {item.evaluationPending && (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-surface-200/50 text-sm flex items-center gap-2">
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Evaluation pending for this question.
        </div>
      )}

      {/* ── Evaluation Failed State ────────────────────────────────────── */}
      {/* Why this is a distinct branch from evaluationPending: a failed AI
          call still has a Feedback document (with evaluationFailed: true),
          unlike a pending question which has no Feedback document at all.
          Distinguishing them gives the student an accurate picture of what
          actually happened. */}
      {!item.evaluationPending && item.evaluationFailed && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex items-start gap-2">
          <svg
            className="w-5 h-5 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            Evaluation unavailable for this answer. This does not reflect
            your actual performance — try regenerating the report later.
          </span>
        </div>
      )}

      {/* ── Normal Evaluated State ─────────────────────────────────────── */}
      {!item.evaluationPending && !item.evaluationFailed && (
        <>
          {/* Student's submitted answer */}
          <div className="mb-4">
            <p className="text-xs font-medium text-surface-200/40 uppercase tracking-wider mb-2">
              Your Answer
            </p>
            {hasAnswer ? (
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 text-sm text-surface-100/80 whitespace-pre-wrap leading-relaxed">
                {item.studentAnswer}
              </div>
            ) : (
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 text-sm text-surface-200/30 italic">
                No answer submitted for this question.
              </div>
            )}
          </div>

          {/* Positives + Missing Points — side by side on larger screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* What you got right */}
            <div>
              <p className="text-xs font-medium text-emerald-300/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                What You Got Right
              </p>
              {item.positives && item.positives.length > 0 ? (
                <ul className="space-y-1.5">
                  {item.positives.map((point, i) => (
                    <li
                      key={i}
                      className="text-sm text-surface-100/70 flex items-start gap-2"
                    >
                      <span className="text-emerald-400 mt-0.5 shrink-0">
                        ✓
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-surface-200/30 italic">
                  No specific strengths identified.
                </p>
              )}
            </div>

            {/* What you missed */}
            <div>
              <p className="text-xs font-medium text-amber-300/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                What You Missed
              </p>
              {item.missingPoints && item.missingPoints.length > 0 ? (
                <ul className="space-y-1.5">
                  {item.missingPoints.map((point, i) => (
                    <li
                      key={i}
                      className="text-sm text-surface-100/70 flex items-start gap-2"
                    >
                      <span className="text-amber-400 mt-0.5 shrink-0">
                        !
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-surface-200/30 italic">
                  Nothing significant missed.
                </p>
              )}
            </div>
          </div>

          {/* Tip callout — visually distinct so it stands out as actionable */}
          {item.tip && (
            <div className="mb-4 p-4 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-start gap-3">
              <svg
                className="w-5 h-5 text-primary-400 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <div>
                <p className="text-xs font-medium text-primary-300 uppercase tracking-wider mb-1">
                  Tip for Improvement
                </p>
                <p className="text-sm text-surface-100/80 leading-relaxed">
                  {item.tip}
                </p>
              </div>
            </div>
          )}

          {/* Model answer — collapsed by default */}
          {/* Why collapsed by default: letting the student review their own
              answer, positives, and gaps FIRST (without immediately seeing
              the "correct" answer) encourages genuine self-assessment rather
              than passive reading. They opt in to seeing it. */}
          {item.modelAnswer && (
            <div>
              <button
                onClick={() => setShowModelAnswer((prev) => !prev)}
                className="flex items-center gap-2 text-sm font-medium text-surface-200/60 hover:text-white transition-colors duration-200 cursor-pointer"
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${
                    showModelAnswer ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                {showModelAnswer ? 'Hide model answer' : 'Show model answer'}
              </button>

              {showModelAnswer && (
                <div className="mt-3 rounded-xl bg-violet-500/5 border border-violet-500/15 p-4 text-sm text-surface-100/80 whitespace-pre-wrap leading-relaxed animate-fade-in-up">
                  {item.modelAnswer}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// Main ReportPage Component
// =============================================================================
export default function ReportPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // ── Loading / data state ─────────────────────────────────────────────
  // Two distinct loading phases are tracked separately (rather than one
  // combined boolean) because the user-facing message is different: phase 1
  // is "evaluating" (can take several seconds — sequential AI calls),
  // phase 2 is "loading report" (fast — just a database read).
  const [phase, setPhase] = useState('evaluating'); // 'evaluating' | 'loading-report' | 'ready' | 'error'
  const [report, setReport] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // ── Load sequence: evaluate, then fetch report ─────────────────────────
  const loadReport = useCallback(async () => {
    setPhase('evaluating');
    setErrorMessage('');

    try {
      // Step 1: trigger evaluation. The backend is idempotent here — if
      // feedback already exists for this session (e.g. user refreshed this
      // page), it returns the existing results instead of re-running AI
      // calls, so calling this unconditionally on every mount is safe and
      // requires no special "already evaluated" branching on our side.
      await evaluateSession(sessionId);

      setPhase('loading-report');

      // Step 2: fetch the combined report now that feedback exists
      const response = await getSessionReport(sessionId);
      setReport(response.data);
      setPhase('ready');
    } catch (err) {
      console.log("========== REPORT PAGE ERROR ==========");
    console.log("Full Error:", err);
    console.log("Status:", err.response?.status);
    console.log("Response:", err.response?.data);
    console.log("URL:", err.config?.url);
    console.log("Method:", err.config?.method);
    console.log("=======================================");

    if (err.response?.status !== 401) {
        setErrorMessage(extractErrorMessage(err));
        setPhase('error');
    }
    }
  }, [sessionId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // ── Computed: overall score color ──────────────────────────────────────
  const overallScore = report?.totalScore;

  // =============================================================================
  // Render: Evaluating state
  // =============================================================================
  if (phase === 'evaluating') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card rounded-2xl p-8 text-center animate-fade-in-up max-w-md">
          <svg
            className="animate-spin h-12 w-12 text-primary-400 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">
            Evaluating Your Answers…
          </h2>
          <p className="text-surface-200/50 text-sm">
            Our AI is reviewing each answer one at a time. This usually takes
            a few seconds per question — thanks for your patience.
          </p>
        </div>
      </div>
    );
  }

  // =============================================================================
  // Render: Loading report state (fast, but still shown for clarity)
  // =============================================================================
  if (phase === 'loading-report') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center animate-fade-in-up">
          <svg
            className="animate-spin h-10 w-10 text-primary-400 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-surface-200/60 text-sm">
            Preparing your report…
          </p>
        </div>
      </div>
    );
  }

  // =============================================================================
  // Render: Error state
  // =============================================================================
  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card rounded-2xl p-8 text-center max-w-md animate-fade-in-up">
          <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Could Not Load Report
          </h2>
          <p className="text-surface-200/50 text-sm mb-6">{errorMessage}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={loadReport}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-violet-600 text-white font-semibold hover:from-primary-500 hover:to-violet-500 transition-all duration-200 cursor-pointer"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-surface-200/70 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-200 cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================================
  // Render: Ready state — full report
  // =============================================================================
  return (
    <div className="min-h-screen relative">
      {/* ── Top Nav (matches DashboardPage / HomePage pattern exactly) ──── */}
      <nav className="border-b border-white/5 bg-white/[0.02] backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-md shadow-primary-500/20">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-primary-300 to-violet-400 bg-clip-text text-transparent">
              MockMate
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-xl text-sm font-medium text-surface-200/70 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-200 cursor-pointer"
            >
              Dashboard
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 rounded-xl text-sm font-medium text-surface-200/70 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-200 flex items-center gap-2 cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* ── Report Header ─────────────────────────────────────────────── */}
        <div className="animate-fade-in-up">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Interview Report
          </h1>
          <p className="text-surface-200/50 text-lg">
            <span className="text-primary-300">{report.company}</span>
            {' · '}
            {report.type}
            {' · '}
            {report.questionCount} questions
          </p>
        </div>

        {/* ── Overall Score Card ───────────────────────────────────────── */}
        <div
          className="mt-8 glass-card rounded-2xl p-8 animate-fade-in-up flex flex-col sm:flex-row items-center justify-between gap-6"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="text-center sm:text-left">
            <p className="text-sm font-medium text-surface-200/40 uppercase tracking-wider mb-1">
              Overall Score
            </p>
            <p className="text-surface-200/50 text-sm">
              Based on {report.questionCount} evaluated answer
              {report.questionCount === 1 ? '' : 's'}
            </p>
          </div>
          <div
            className={`flex items-center justify-center rounded-2xl border px-8 py-5 ${getScoreColorClasses(
              overallScore,
            )}`}
          >
            <span
              className={`text-5xl font-bold ${getScoreTextColor(
                overallScore,
              )}`}
            >
              {overallScore !== null && overallScore !== undefined
                ? overallScore
                : '—'}
            </span>
            <span className="text-lg text-surface-200/40 ml-1">/10</span>
          </div>
        </div>

        {/* ── Per-Question Report Cards ────────────────────────────────── */}
        <div className="mt-8 space-y-5">
          {report.questions.map((item, index) => (
            <QuestionReportCard
              key={item.questionId}
              item={item}
              index={index}
            />
          ))}
        </div>

        {/* ── Bottom Action Buttons ────────────────────────────────────── */}
        <div
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up"
          style={{ animationDelay: '0.1s' }}
        >
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-medium text-surface-200/70 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Back to Dashboard
          </button>
          <button
            onClick={() => navigate('/home')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-violet-600 text-white text-sm font-semibold hover:from-primary-500 hover:to-violet-500 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Try Another Interview
          </button>
        </div>
      </main>
    </div>
  );
}
