import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useTimer from '../hooks/useTimer';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import toast from 'react-hot-toast';
import {
  getActiveSession,
  submitAnswer,
  completeSession as completeSessionApi,
} from '../services/api';

// =============================================================================
// SessionPage — Live Interview Experience
// =============================================================================

function extractErrorMessage(err) {
  if (err.response?.data?.message) return err.response.data.message;
  if (err.response?.data?.error) return err.response.data.error;
  if (err.message) return err.message;
  return 'An unexpected error occurred. Please try again.';
}

const DIFFICULTY_COLORS = {
  Easy: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  Medium: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  Hard: 'bg-red-500/15 text-red-300 border-red-500/20',
};

function SessionInner({ session, initialRemainingSeconds, sessionId }) {
  const navigate = useNavigate();
  const { remainingSeconds, isExpired, formattedTime, isWarning } = useTimer(initialRemainingSeconds);
  
  // ── Question navigation state ──────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const questions = session.questions;
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];
  
  // ── Answer state ───────────────────────────────────────────────────────
  const [answers, setAnswers] = useState(() => {
    const initial = new Map();
    for (const answer of session.answers) {
      if (answer.questionId) {
        initial.set(answer.questionId.toString(), answer.text || '');
      }
    }
    return initial;
  });
  
  const currentAnswerText = answers.get(currentQuestion._id.toString()) || '';
  const {
  supported,
  isRecording,
  startRecording,
  stopRecording,
} = useSpeechRecognition((text) => {
  handleAnswerChange(text);
});
  
  // ── Saving / Action State ──────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const hasCompletedRef = useRef(false);

  const handleAnswerChange = useCallback(
    (text) => {
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(currentQuestion._id.toString(), text);
        return next;
      });
    },
    [currentQuestion._id],
  );

  // ── Save current answer to backend ─────────────────────────────────────
  const saveCurrentAnswer = useCallback(async () => {
    const questionId = currentQuestion._id.toString();
    const text = answers.get(questionId) || '';
    setIsSaving(true);
    
    try {
      await submitAnswer(sessionId, { questionId, text });
      toast.success('Answer saved!', { id: `save-${questionId}` });
      return true;
    } catch (err) {
      toast.error(extractErrorMessage(err));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [currentQuestion._id, answers, sessionId]);

  // ── Navigate to next question (save first) ─────────────────────────────
  const handleNext = useCallback(async () => {
    stopRecording();

    const saved = await saveCurrentAnswer();
    if (saved && currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [saveCurrentAnswer, currentIndex, totalQuestions]);

  // ── Navigate to previous question ──────────────────────────────────────
  const handlePrevious = useCallback(async () => {
    stopRecording();
    const saved = await saveCurrentAnswer();
    if (saved && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [saveCurrentAnswer, currentIndex]);

  // ── Complete the session (with retry for network failures) ─────────────
  const finalizeSession = useCallback(
    async (isAutoSubmit = false) => {
      if (hasCompletedRef.current) return;
      hasCompletedRef.current = true;
      setIsCompleting(true);
      
      const questionId = currentQuestion._id.toString();
      const text = answers.get(questionId) || '';
      if (text.trim()) {
        try {
          await submitAnswer(sessionId, { questionId, text });
        } catch {
          // Fail silently on final individual save to avoid blocking session finalization
        }
      }

      let retryCount = 0;
      const maxRetries = 1;
      
      while (retryCount <= maxRetries) {
        try {
          await completeSessionApi(sessionId);
          toast.success('Interview session completed successfully!');
          navigate(`/session/${sessionId}/report`, { replace: true });
          return;
        } catch (err) {
          const status = err.response?.status;
          if (status === 400) {
            const message = extractErrorMessage(err);
            if (message.includes('already completed')) {
              toast.success('Session finalized.');
              navigate(`/session/${sessionId}/report`, { replace: true });
              return;
            }
            toast.error(message);
            hasCompletedRef.current = false;
            setIsCompleting(false);
            return;
          }
          if (status === 404 || status === 403) {
            toast.error(extractErrorMessage(err));
            setIsCompleting(false);
            return;
          }
          
          if (retryCount < maxRetries) {
            retryCount++;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } else {
            toast.error('Network error encountered while finishing. Please tap button to try again.');
            hasCompletedRef.current = false;
            setIsCompleting(false);
            return;
          }
        }
      }
    },
    [currentQuestion._id, answers, sessionId, navigate],
  );

  useEffect(() => {
    if (isExpired) {
      finalizeSession(true);
    }
  }, [isExpired, finalizeSession]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!hasCompletedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  if (isCompleting) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card rounded-2xl p-6 sm:p-8 text-center animate-fade-in-up w-full max-w-sm sm:max-w-md">
          <svg className="animate-spin h-10 w-10 sm:h-12 sm:w-12 text-primary-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <h2 className="text-lg sm:text-xl font-semibold text-white mb-1 sm:mb-2">Completing Interview…</h2>
          <p className="text-surface-200/50 text-xs sm:text-sm">Saving answers and calculating scores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* ── Sticky Header with Timer ──────────────────────────────────── */}
      <nav className="border-b border-white/5 bg-white/[0.02] backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[4rem] sm:h-16 flex flex-col sm:flex-row items-center justify-between py-3 sm:py-0 gap-3 sm:gap-4">
          {/* Left: Progress */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-start">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-md shadow-primary-500/20 shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-medium text-surface-200/60 block leading-tight">
                Question {currentIndex + 1} of {totalQuestions}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-surface-200/40 mt-0.5">
                <span className="truncate max-w-[120px] sm:max-w-none">{session.company}</span>
                <span>·</span>
                <span>{session.type}</span>
              </div>
            </div>
          </div>
          {/* Right: Timer */}
          <div
            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border font-mono text-base sm:text-lg font-bold transition-all duration-300 w-full sm:w-auto justify-center sm:justify-end ${
              isWarning
                ? 'bg-red-500/15 border-red-500/30 text-red-300 animate-pulse'
                : 'bg-white/[0.03] border-white/10 text-surface-100'
            }`}
          >
            <svg className="w-4 h-4 sm:w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formattedTime}</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-white/5 w-full">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-violet-500 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </nav>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="glass-card rounded-2xl p-5 sm:p-8 animate-fade-in-up">
          {/* Question metadata */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium border ${
              DIFFICULTY_COLORS[currentQuestion.difficulty] || DIFFICULTY_COLORS.Medium
            }`}>
              {currentQuestion.difficulty}
            </span>
            <span className="text-[11px] sm:text-xs text-surface-200/40">
              {currentQuestion.topic}
            </span>
            <span className="text-[11px] sm:text-xs text-surface-200/30 ml-auto">
              ⏱ {Math.floor((currentQuestion.timeLimit || 300) / 60)}m suggested
            </span>
          </div>
          {/* Question text */}
          <h2 className="text-base sm:text-xl font-semibold text-white leading-relaxed mb-5">
            {currentQuestion.text}
          </h2>
          {/* Answer textarea */}
          <div className="relative">
            <textarea
              value={currentAnswerText}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Type your answer here…"
              rows={8}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-sm sm:text-base text-surface-100 placeholder-surface-200/30 p-4 focus:outline-none focus:border-primary-500 transition-all duration-200 resize-y min-h-[180px]"
              disabled={isSaving}
            />
            {/* Minimal Inline Saving Spinner overlay */}
            {isSaving && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs text-surface-200/40 pointer-events-none bg-surface-950/40 backdrop-blur-sm px-2 py-1 rounded-md">
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between flex-wrap gap-3">

            <button
                type="button"
                disabled={!supported}
                onClick={() => {
                    if (isRecording) {
                        stopRecording();
                    } else {
                        startRecording(currentAnswerText);
                    }
                }}
                className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                    isRecording
                        ? "bg-red-600 hover:bg-red-500 text-white"
                        : "bg-primary-600 hover:bg-primary-500 text-white"
                }`}
            >
                {isRecording
                    ? "🛑 Stop Recording"
                    : "🎤 Start Recording"}
            </button>

            {!supported && (
                <span className="text-yellow-400 text-sm">
                    Browser speech recognition is not supported.
                </span>
            )}
            {isRecording && (
                <span className="text-red-400 text-sm animate-pulse">
                    🔴 Listening...
                </span>
            )}
        </div>
        </div>

        {/* ── Navigation Buttons ──────────────────────────────────────── */}
        <div className="mt-5 flex items-center justify-between gap-2 sm:gap-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {/* Previous */}
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0 || isSaving}
            className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium text-surface-200/70 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden xs:inline">Previous</span>
          </button>
          
          {/* Question dot indicators */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-2 max-w-[45%] sm:max-w-none scrollbar-none justify-center">
            {questions.map((q, idx) => {
              const hasAnswer = (answers.get(q._id.toString()) || '').trim() !== '';
              return (
                <div
                  key={q._id}
                  className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 transition-all duration-200 ${
                    idx === currentIndex
                      ? 'bg-primary-400 scale-125'
                      : hasAnswer
                        ? 'bg-emerald-400/60'
                        : 'bg-white/15'
                  }`}
                />
              );
            })}
          </div>
          
          {/* Next or Finish */}
          {currentIndex < totalQuestions - 1 ? (
            <button
              onClick={handleNext}
              disabled={isSaving}
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-500 hover:to-violet-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-lg shadow-primary-600/20 shrink-0"
            >
              <span>Next</span>
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => finalizeSession(false)}
              disabled={isSaving || isCompleting}
              className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 shrink-0"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>Finish</span>
            </button>
          )}
        </div>

        {/* Time warning banner (last 60 seconds) */}
        {isWarning && (
          <div className="mt-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs sm:text-sm flex items-start gap-3 animate-fade-in-up">
            <svg className="w-5 h-5 shrink-0 animate-pulse mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="font-semibold">Time is running out!</p>
              <p className="text-red-300/70 mt-0.5">
                Less than {remainingSeconds} seconds remaining. Progress will auto-submit when the timer expires.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// =============================================================================
// Main SessionPage component — handles loading skeleton overlay
// =============================================================================
export default function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [session, setSession] = useState(null);
  const [initialRemainingSeconds, setInitialRemainingSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await getActiveSession();
        const data = response.data;
        
        if (!data.session) {
          if (sessionId) {
            navigate(`/session/${sessionId}/report`, { replace: true });
          } else {
            navigate('/home', { replace: true });
          }
          return;
        }
        
        const activeId = data.session._id.toString();
        if (sessionId && activeId !== sessionId) {
          navigate(`/session/${activeId}`, { replace: true });
          return;
        }
        
        setSession(data.session);
        setInitialRemainingSeconds(data.remainingTimeSeconds);
      } catch (err) {
        if (err.response?.status !== 401) {
          if (err.response?.status === 403) {
            toast.error('You do not have access to this session.');
          } else if (err.response?.status === 404) {
            toast.error('Session not found.');
          } else {
            toast.error(extractErrorMessage(err));
          }
          navigate('/home', { replace: true });
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, [sessionId, navigate]);

  // Loading Spinner prevents blank white screens during async evaluation
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950">
        <div className="text-center animate-fade-in-up px-4">
          <svg className="animate-spin h-9 w-9 text-primary-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-surface-200/60 text-xs sm:text-sm tracking-wide">Assembling your session space...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <SessionInner
      session={session}
      initialRemainingSeconds={initialRemainingSeconds}
      sessionId={session._id}
    />
  );
}