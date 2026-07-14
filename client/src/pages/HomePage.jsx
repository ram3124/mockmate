import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getActiveSession, startSession } from '../services/api';
import toast from 'react-hot-toast';

// =============================================================================
// Enum Constants — must match the server's Question model exactly
// =============================================================================
// Why hardcoded here instead of fetching from an API:
// These enum values are defined in the Mongoose schema and rarely change.
// Fetching them dynamically would add an extra API call on every page load
// for data that's essentially static. If a new company or type is added to
// the database, this array should be updated to match.
// =============================================================================

const COMPANIES = [
  { value: 'Google', label: 'Google', icon: '🔍' },
  { value: 'Amazon', label: 'Amazon', icon: '📦' },
  { value: 'Flipkart', label: 'Flipkart', icon: '🛒' },
  { value: 'Microsoft', label: 'Microsoft', icon: '💻' },
  { value: 'TCS', label: 'TCS', icon: '🏢' },
  { value: 'Infosys', label: 'Infosys', icon: '🌐' },
  { value: 'General', label: 'General', icon: '📋' },
];

const TYPES = [
  { value: 'DSA', label: 'DSA', description: 'Data Structures & Algorithms' },
  { value: 'HR', label: 'HR', description: 'Behavioural & Situational' },
  { value: 'CoreCS', label: 'Core CS', description: 'OS, DBMS, Networks' },
  { value: 'SystemDesign', label: 'System Design', description: 'Architecture & Scalability' },
];

const DIFFICULTIES = [
  { value: '', label: 'Any Difficulty', description: 'Random mix' },
  { value: 'Easy', label: 'Easy', description: 'Fundamentals' },
  { value: 'Medium', label: 'Medium', description: 'Intermediate' },
  { value: 'Hard', label: 'Hard', description: 'Advanced' },
];

// =============================================================================
// Helper: Extract readable error from Axios error
// =============================================================================
function extractErrorMessage(err) {
  return (
    err.response?.data?.message ||
    err.response?.data?.error ||
    'Something went wrong. Please try again.'
  );
}

// =============================================================================
// HomePage Component
// =============================================================================

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ── Active session state ───────────────────────────────────────────────
  // Why track active session separately: On page load we check if the user
  // already has an in-progress interview. If they do, we show a "Resume"
  // prompt instead of letting them start a new one (the backend prevents
  // duplicate active sessions anyway, but this gives clearer UX).
  const [activeSession, setActiveSession] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [isCheckingActive, setIsCheckingActive] = useState(true);

  // ── Form state ─────────────────────────────────────────────────────────
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [isStarting, setIsStarting] = useState(false);

  // Note: The previous local inline 'activeCheckError' and 'startError' states 
  // have been cleanly migrated to trigger transient toast alerts as requested 
  // by the global UI polish pass guidelines.

  // ── Check for active session on page load ──────────────────────────────
  // Why on mount: If the user navigates away from an interview and comes
  // back to the home page, they should see their active session immediately
  // rather than having to figure out where they left off.
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const response = await getActiveSession();
        const data = response.data;

        if (data.session) {
          setActiveSession(data.session);
          setRemainingTime(data.remainingTimeSeconds || 0);
        }
      } catch (err) {
        // Don't show error for 401 — the interceptor handles that.
        // Only show errors for unexpected failures (network issues, etc.)
        if (err.response?.status !== 401) {
          toast.error(extractErrorMessage(err));
        }
      } finally {
        setIsCheckingActive(false);
      }
    };

    checkActiveSession();
  }, []);

  // ── Start a new interview session ──────────────────────────────────────
  const handleStartSession = async () => {
    setIsStarting(true);

    // Build request body — only include difficulty if the user selected one.
    // Why conditional: The backend treats difficulty as optional. Sending an
    // empty string would fail validation, so we omit it entirely.
    const requestBody = {
      company: selectedCompany,
      type: selectedType,
      count: questionCount,
    };

    if (selectedDifficulty) {
      requestBody.difficulty = selectedDifficulty;
    }

    try {
      const response = await startSession(requestBody);
      const data = response.data;

      if (data.session) {
        // Trigger explicit success toast to confirm transition state
        toast.success('Session started successfully! Good luck.');
        
        // Navigate to the session page with the new session's ID.
        // The session page (built later) will use this ID to load questions.
        navigate(`/session/${data.session._id}`);
      } else {
        // Edge case: backend auto-completed an expired session and returned
        // session: null. Reload the page to clear the stale state.
        toast.error(data.message || 'Session could not be created. Please try again.');
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsStarting(false);
    }
  };

  // ── Resume an existing active session ──────────────────────────────────
  const handleResumeSession = () => {
    if (activeSession?._id) {
      navigate(`/session/${activeSession._id}`);
    }
  };

  // ── Computed: Can the form be submitted? ───────────────────────────────
  // Why computed instead of checking inside handleSubmit: This drives the
  // disabled state of the button, giving immediate visual feedback that
  // both required fields must be filled.
  const canStart = selectedCompany !== '' && selectedType !== '' && !isStarting;

  // ── Format remaining time for display ──────────────────────────────────
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* ── Top Nav (Polished for 375px Mobile Viewports) ─────────────────────── */}
      {/* 
        Mobile Adjustment: Changed fixed height 'h-16' to a fluid 'min-h-[4rem] sm:h-16' 
        and switched flex alignment to vertical stacking on tiny viewports ('flex-col sm:flex-row') 
        to ensure the brand header and three navigation controls fit beautifully without overlapping.
      */}
      <nav className="border-b border-white/5 bg-white/[0.02] backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[4rem] sm:h-16 flex flex-col sm:flex-row items-center justify-between py-3 sm:py-0 gap-3 sm:gap-4">
          <div className="flex items-center gap-3 self-start sm:self-center">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-md shadow-primary-500/20">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <span className="text-base sm:text-lg font-bold bg-gradient-to-r from-primary-300 to-violet-400 bg-clip-text text-transparent">
              MockMate
            </span>
          </div>

          {/* Adjusted padding ('px-2.5 py-1.5 sm:px-4 sm:py-2') to align cleanly on an iPhone SE layout limit */}
          <div className="flex items-center gap-1.5 sm:gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium text-surface-200/70 hover:text-white border border-white/10 hover:bg-white/5 transition-all duration-200 cursor-pointer"
            >
              Dashboard
            </button>

            {/* NEW LEADERBOARD BUTTON */}
            <button
              onClick={() => navigate('/leaderboard')}
              className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium text-surface-200/70 hover:text-white border border-white/10 hover:bg-white/5 transition-all duration-200 cursor-pointer"
            >
              Leaderboard
            </button>

            <button
              onClick={logout}
              className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium text-surface-200/70 hover:text-white border border-white/10 hover:bg-white/5 transition-all duration-200 flex items-center gap-1 sm:gap-2 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden xxs:inline">Sign out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Header */}
        <div className="animate-fade-in-up">
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-1">
            Start an Interview
          </h1>
          <p className="text-surface-200/50 text-sm sm:text-lg">
            Configure your mock interview, <span className="text-primary-300 font-medium">{user?.name || 'User'}</span>
          </p>
        </div>

        {/* ── Active Session Resume Banner ─────────────────────────────── */}
        {/* Explicit checking component prevents empty visual flashes while loading initial state */}
        {isCheckingActive && (
          <div className="mt-6 glass-card rounded-2xl p-5 sm:p-6 animate-fade-in-up flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-primary-400 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-surface-200/60 text-xs sm:text-sm">Checking for active sessions…</span>
          </div>
        )}

        {activeSession && !isCheckingActive && (
          <div className="mt-6 glass-card rounded-2xl p-5 sm:p-6 animate-fade-in-up border-l-4 border-amber-400/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <h3 className="text-base sm:text-lg font-semibold text-white">Active Interview in Progress</h3>
                </div>
                <p className="text-surface-200/50 text-xs sm:text-sm mb-1">
                  <span className="text-surface-100 font-medium">{activeSession.company}</span> · {activeSession.type} · {activeSession.questions?.length || 0} questions
                </p>
                <p className="text-surface-200/40 text-[11px] sm:text-xs">
                  Time remaining: <span className="text-amber-300 font-medium">{formatTime(remainingTime)}</span>
                </p>
              </div>
              <button
                onClick={handleResumeSession}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-xs sm:text-sm hover:from-amber-400 hover:to-orange-400 transition-all duration-200 shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Resume Interview
              </button>
            </div>
          </div>
        )}

        {/* ── Interview Configurator Form ──────────────────────────────── */}
        <div className="mt-6 sm:mt-8 space-y-6 sm:space-y-8">

          {/* Company Selector */}
          <div className="glass-card rounded-2xl p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-base sm:text-lg font-semibold text-white mb-0.5">Target Company</h2>
            <p className="text-surface-200/40 text-xs sm:text-sm mb-4">Select the company whose interview style you want to practice</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {COMPANIES.map((company) => (
                <button
                  key={company.value}
                  onClick={() => setSelectedCompany(company.value)}
                  className={`group rounded-xl p-3 sm:p-4 text-left transition-all duration-200 cursor-pointer border ${
                    selectedCompany === company.value
                      ? 'bg-primary-500/15 border-primary-500/40 shadow-md shadow-primary-500/10'
                      : 'bg-white/[0.03] border-white/5 hover:border-primary-500/20 hover:bg-primary-500/5'
                  }`}
                >
                  <span className="text-xl sm:text-2xl block mb-1.5">{company.icon}</span>
                  <span className={`text-xs sm:text-sm font-medium ${
                    selectedCompany === company.value ? 'text-primary-300' : 'text-surface-100'
                  }`}>
                    {company.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Type Selector */}
          <div className="glass-card rounded-2xl p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <h2 className="text-base sm:text-lg font-semibold text-white mb-0.5">Question Type</h2>
            <p className="text-surface-200/40 text-xs sm:text-sm mb-4">Choose the category of questions</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  className={`group rounded-xl p-3 sm:p-4 text-left transition-all duration-200 cursor-pointer border ${
                    selectedType === type.value
                      ? 'bg-primary-500/15 border-primary-500/40 shadow-md shadow-primary-500/10'
                      : 'bg-white/[0.03] border-white/5 hover:border-primary-500/20 hover:bg-primary-500/5'
                  }`}
                >
                  <span className={`text-xs sm:text-sm font-semibold block mb-0.5 ${
                    selectedType === type.value ? 'text-primary-300' : 'text-surface-100'
                  }`}>
                    {type.label}
                  </span>
                  <span className="text-[11px] sm:text-xs text-surface-200/40">{type.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty + Count Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* Difficulty Selector (Optional) */}
            <div className="glass-card rounded-2xl p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-base sm:text-lg font-semibold text-white">Difficulty</h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium bg-surface-200/10 text-surface-200/40 uppercase tracking-wider">
                  Optional
                </span>
              </div>
              <p className="text-surface-200/40 text-xs sm:text-sm mb-4">Leave as &quot;Any&quot; for a random mix</p>
              <div className="space-y-2">
                {DIFFICULTIES.map((diff) => (
                  <button
                    key={diff.value}
                    onClick={() => setSelectedDifficulty(diff.value)}
                    className={`w-full rounded-xl p-2.5 sm:p-3 text-left transition-all duration-200 cursor-pointer border flex items-center justify-between ${
                      selectedDifficulty === diff.value
                        ? 'bg-primary-500/15 border-primary-500/40'
                        : 'bg-white/[0.03] border-white/5 hover:border-primary-500/20 hover:bg-primary-500/5'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <span className={`text-xs sm:text-sm font-medium ${
                        selectedDifficulty === diff.value ? 'text-primary-300' : 'text-surface-100'
                      }`}>
                        {diff.label}
                      </span>
                      <span className="text-[11px] sm:text-xs text-surface-200/40 ml-2 hidden xxs:inline">{diff.description}</span>
                    </div>
                    {selectedDifficulty === diff.value && (
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count */}
            <div className="glass-card rounded-2xl p-5 sm:p-6 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
              <h2 className="text-base sm:text-lg font-semibold text-white mb-0.5">Number of Questions</h2>
              <p className="text-surface-200/40 text-xs sm:text-sm mb-4 sm:mb-6">Choose between 1 and 10 questions</p>

              <div className="text-center mb-4 sm:mb-6">
                <span className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-primary-300 to-violet-400 bg-clip-text text-transparent">
                  {questionCount}
                </span>
                <p className="text-surface-200/40 text-xs sm:text-sm mt-0.5">
                  {questionCount === 1 ? 'question' : 'questions'}
                </p>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="1"
                max="10"
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary-500"
                style={{
                  background: `linear-gradient(to right, var(--color-primary-500) 0%, var(--color-primary-500) ${((questionCount - 1) / 9) * 100}%, rgba(255,255,255,0.08) ${((questionCount - 1) / 9) * 100}%, rgba(255,255,255,0.08) 100%)`,
                }}
              />
              <div className="flex justify-between text-[10px] sm:text-xs text-surface-200/30 mt-2">
                <span>1</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>
          </div>

          {/* Start Button */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <button
              onClick={handleStartSession}
              disabled={!canStart}
              className="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-primary-600 to-violet-600 text-white text-base sm:text-lg font-semibold hover:from-primary-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-surface-950 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 cursor-pointer shadow-lg shadow-primary-600/20 hover:shadow-primary-500/30"
            >
              {isStarting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm sm:text-base">Starting Interview…</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-sm sm:text-base">Start Interview</span>
                </>
              )}
            </button>

            {/* Hint text below button */}
            {!canStart && !isStarting && (
              <p className="text-center text-[11px] sm:text-xs text-surface-200/30 mt-3">
                Select a company and question type to begin
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}




