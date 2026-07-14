import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import {
  getDashboardStats,
  getWeaknessAnalysis,
  getScoreTrend,
  getSessionHistory,
} from '../services/api';

// =============================================================================
// Helper: Extract readable error message from Axios error
// =============================================================================
// Matches the exact pattern used throughout SessionPage.jsx, HomePage.jsx,
// and ReportPage.jsx so error messages behave consistently across the app.
function extractErrorMessage(err) {
  if (err.response?.data?.message) return err.response.data.message;
  if (err.response?.data?.error) return err.response.data.error;
  if (err.message) return err.message;
  return 'Something went wrong. Please try again.';
}

// =============================================================================
// Score color helpers — copied verbatim from ReportPage.jsx so color meaning
// stays consistent everywhere a score appears in the app (>=7 green,
// 4-6.9 amber, <4 red).
// =============================================================================
function getScoreColorClasses(score) {
  if (score === null || score === undefined) {
    return 'bg-white/5 text-surface-200/40 border-white/10';
  }
  if (score >= 7) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20';
  if (score >= 4) return 'bg-amber-500/15 text-amber-300 border-amber-500/20';
  return 'bg-red-500/15 text-red-300 border-red-500/20';
}

function getScoreTextColor(score) {
  if (score === null || score === undefined) return 'text-surface-200/40';
  if (score >= 7) return 'text-emerald-400';
  if (score >= 4) return 'text-amber-400';
  return 'text-red-400';
}

// Solid hex equivalents of the score color classes above — Recharts and SVG
// fill/stroke props need real color values, Tailwind classes don't apply
// inside chart-rendered SVG the way they do in normal DOM elements.
function getScoreHexColor(score) {
  if (score === null || score === undefined) return '#9CA3AF';
  if (score >= 7) return '#34D399';
  if (score >= 4) return '#FBBF24';
  return '#F87171';
}

// =============================================================================
// Small inline loading skeleton — pulsing gray box, reused across every
// section below so the loading state feels consistent regardless of which
// section is still fetching.
// =============================================================================
function SkeletonBox({ className = '' }) {
  return (
    <div className={`animate-pulse bg-white/[0.04] rounded-xl ${className}`} />
  );
}

// =============================================================================
// Small inline error box with retry — reused across every section so a
// single failed API call never blocks the rest of the dashboard from
// rendering normally.
// =============================================================================
function SectionError({ message, onRetry }) {
  return (
    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center justify-between gap-3 flex-wrap">
      <span className="flex items-center gap-2">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {message}
      </span>
      <button
        onClick={onRetry}
        className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-medium transition-colors cursor-pointer shrink-0"
      >
        Retry
      </button>
    </div>
  );
}

// =============================================================================
// Section 1 — Stat Cards Row
// =============================================================================
function StatCardsSection() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await getDashboardStats();

      console.log("Dashboard API Response:", response.data);

      setStats(response.data.stats);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBox key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (error) {
    return <SectionError message={error} onRetry={load} />;
  }

  // A brand new user has totalSessions === 0 — show an encouraging message
  // instead of a grid of stark zeros, which can feel discouraging on first login.
  console.log("Stats state:", stats);
  const isNewUser = !stats || (stats.totalSessions ?? 0) === 0;

  if (isNewUser) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-xl bg-primary-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">No interviews yet</h3>
        <p className="text-surface-200/40 text-sm">
          Complete your first mock interview to start seeing your stats here.
        </p>
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Sessions',
      value: stats.totalSessions,
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      ),
      iconColor: 'text-primary-400',
      iconBg: 'bg-primary-500/10',
      valueColor: 'text-white',
    },
    {
      label: 'Average Score',
      value: stats.avgScore?.toFixed(1) ?? "0.0",
      suffix: '/10',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      ),
      iconColor: getScoreTextColor(stats.avgScore),
      iconBg: 'bg-white/[0.03]',
      valueColor: getScoreTextColor(stats.avgScore),
    },
    {
      label: 'Current Streak',
      value: stats.streak,
      suffix: stats.streak === 1 ? ' day' : ' days',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      ),
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
      valueColor: 'text-white',
    },
      {
      label: 'Best Company',
      value: stats.bestCompany?.company || '—',
      suffix: stats.bestScore !== null && stats.bestScore !== undefined ? ` (${stats.bestScore}/10)` : '',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M19 21H5m14 0v-7a2 2 0 00-2-2H7a2 2 0 00-2 2v7m5-13h2m-2 4h2" />
      ),
      iconColor: 'text-violet-400',
      iconBg: 'bg-violet-500/10',
      valueColor: 'text-white',
      smallValue: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="glass-card rounded-2xl p-5 animate-fade-in-up"
        >
          <div className={`w-9 h-9 rounded-lg ${card.iconBg} flex items-center justify-center mb-3`}>
            <svg className={`w-5 h-5 ${card.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              {card.icon}
            </svg>
          </div>
          <p className="text-xs font-medium text-surface-200/40 uppercase tracking-wider mb-1">
            {card.label}
          </p>
          <p className={`font-bold ${card.valueColor} ${card.smallValue ? 'text-lg truncate' : 'text-2xl'}`}>
            {card.value}
            {card.suffix && (
              <span className="text-sm font-medium text-surface-200/40">{card.suffix}</span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Section 2 — Score Trend Chart
// =============================================================================
function ScoreTrendSection() {
  const [trend, setTrend] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await getScoreTrend();
      // Format the date once here rather than inside the chart's tick
      // formatter, so the same formatted label is available for both the
      // X-axis and the tooltip without recalculating it twice.
      const formatted = (response.data.trend || response.data || []).map((point) => ({
        ...point,
        formattedDate: new Date(point.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      }));
      setTrend(formatted);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
      <h2 className="text-lg font-semibold text-white mb-1">Score Trend</h2>
      <p className="text-surface-200/40 text-sm mb-5">
        Your performance across recent interviews
      </p>

      {isLoading && <SkeletonBox className="h-64" />}

      {!isLoading && error && <SectionError message={error} onRetry={load} />}

      {!isLoading && !error && trend.length < 2 && (
        <div className="h-64 flex flex-col items-center justify-center text-center px-4">
          <svg className="w-10 h-10 text-surface-200/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-surface-200/40 text-sm">
            Complete a few more interviews to see your progress trend.
          </p>
        </div>
      )}

      {!isLoading && !error && trend.length >= 2 && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="formattedDate"
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 10]}
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1625',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontSize: '13px',
                  color: '#fff',
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}
                formatter={(value, name, props) => [
                  `${value}/10`,
                  props.payload.company || 'Score',
                ]}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#A78BFA"
                strokeWidth={2.5}
                dot={{ fill: '#A78BFA', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: '#A78BFA' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Section 3 — Weakness Summary
// =============================================================================
function WeaknessSection() {
  const [weaknesses, setWeaknesses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await getWeaknessAnalysis();
      setWeaknesses(response.data.weaknesses || response.data || []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
      <h2 className="text-lg font-semibold text-white mb-1">Weakest Topics</h2>
      <p className="text-surface-200/40 text-sm mb-5">
        Areas with your lowest average scores
      </p>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonBox key={i} className="h-10" />
          ))}
        </div>
      )}

      {!isLoading && error && <SectionError message={error} onRetry={load} />}

      {!isLoading && !error && weaknesses.length === 0 && (
        <div className="py-8 text-center">
          <svg className="w-10 h-10 text-surface-200/20 mb-3 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="text-surface-200/40 text-sm">
            Complete interviews across different topics to see your weakest areas.
          </p>
        </div>
      )}

      {!isLoading && !error && weaknesses.length > 0 && (
        <div className="space-y-3">
          {weaknesses.map((item) => (
            <div
              key={item.topic}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-colors duration-150 group"
            >
              <div className="w-28 sm:w-36 shrink-0">
                <p className="text-sm font-medium text-surface-100 truncate">{item.topic}</p>
                <p className="text-xs text-surface-200/30">
                  {item.numberOfQuestions} question{item.numberOfQuestions === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(item.avgScore / 10) * 100}%`,
                    backgroundColor: getScoreHexColor(item.avgScore),
                  }}
                />
              </div>
              <span className={`text-sm font-semibold w-10 text-right ${getScoreTextColor(item.avgScore)}`}>
                {item.avgScore}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Section 4 — Session History
// =============================================================================
function SessionHistorySection() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await getSessionHistory();
      setSessions(response.data.sessions || []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const goToReport = (sessionId) => {
    navigate(`/session/${sessionId}/report`);
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
      <h2 className="text-lg font-semibold text-white mb-1">Session History</h2>
      <p className="text-surface-200/40 text-sm mb-5">
        Click any session to view its full report
      </p>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBox key={i} className="h-14" />
          ))}
        </div>
      )}

      {!isLoading && error && <SectionError message={error} onRetry={load} />}

      {!isLoading && !error && sessions.length === 0 && (
        <div className="py-10 text-center">
          <svg className="w-12 h-12 text-surface-200/20 mb-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-surface-200/40 text-sm mb-4">No sessions yet — start your first interview.</p>
          <button
            onClick={() => navigate('/home')}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-violet-600 text-white text-sm font-semibold hover:from-primary-500 hover:to-violet-500 transition-all duration-200 cursor-pointer shadow-lg shadow-primary-600/20"
          >
            Start Your First Interview
          </button>
        </div>
      )}

      {!isLoading && !error && sessions.length > 0 && (
        <>
          {/* ── Desktop table — hidden on small screens ────────────────── */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left">
                  <th className="pb-3 font-medium text-surface-200/40 text-xs uppercase tracking-wider">Company</th>
                  <th className="pb-3 font-medium text-surface-200/40 text-xs uppercase tracking-wider">Type</th>
                  <th className="pb-3 font-medium text-surface-200/40 text-xs uppercase tracking-wider">Score</th>
                  <th className="pb-3 font-medium text-surface-200/40 text-xs uppercase tracking-wider">Date</th>
                  <th className="pb-3 font-medium text-surface-200/40 text-xs uppercase tracking-wider">Answered</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr
                    key={session._id}
                    onClick={() => goToReport(session._id)}
                    className="border-b border-white/[0.03] hover:bg-white/[0.03] cursor-pointer transition-colors duration-150"
                  >
                    <td className="py-3.5 text-surface-100 font-medium">{session.company}</td>
                    <td className="py-3.5 text-surface-200/60">{session.type}</td>
                    <td className="py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getScoreColorClasses(session.totalScore)}`}>
                        {session.totalScore ?? '—'}/10
                      </span>
                    </td>
                    <td className="py-3.5 text-surface-200/40">{formatDate(session.endTime)}</td>
                    <td className="py-3.5 text-surface-200/40">
                      {session.answeredCount}/{session.questionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile stacked cards — hidden on sm and above ───────────── */}
          <div className="sm:hidden space-y-3">
            {sessions.map((session) => (
              <button
                key={session._id}
                onClick={() => goToReport(session._id)}
                className="w-full text-left rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] transition-colors duration-150 cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-surface-100">{session.company}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getScoreColorClasses(session.totalScore)}`}>
                    {session.totalScore ?? '—'}/10
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-surface-200/40">
                  <span>{session.type} · {session.answeredCount}/{session.questionCount} answered</span>
                  <span>{formatDate(session.endTime)}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Main DashboardPage Component
// =============================================================================
export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';

  const roleBadge = {
    admin: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
    student: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  };

  const roleClass = roleBadge[user?.role] || roleBadge.student;

  return (
    <div className="min-h-screen relative">
      {/* ── Top Nav — unchanged from the existing placeholder version ───── */}
      <nav className="border-b border-white/5 bg-white/[0.02] backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-md shadow-primary-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-primary-300 to-violet-400 bg-clip-text text-transparent">
              MockMate
            </span>
          </div>

          <button
            onClick={logout}
            className="px-4 py-2 rounded-xl text-sm font-medium text-surface-200/70 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-200 flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </nav>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Welcome Section — unchanged */}
        <div className="animate-fade-in-up">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Welcome back, <span className="bg-gradient-to-r from-primary-300 to-violet-400 bg-clip-text text-transparent">{user?.name || 'User'}</span>
          </h1>
          <p className="text-surface-200/50 text-lg">
            Here's your account overview
          </p>
        </div>

        {/* Profile Card — unchanged from existing version */}
        <div className="mt-8 glass-card rounded-2xl p-6 sm:p-8 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-lg shadow-primary-500/20">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h2 className="text-xl font-semibold text-white truncate">
                  {user?.name || 'User'}
                </h2>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${roleClass}`}>
                  {user?.role || 'student'}
                </span>
              </div>
              <p className="text-surface-200/50 text-sm truncate">
                {user?.email || 'No email'}
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium text-surface-200/40 uppercase tracking-wider">Email</span>
              </div>
              <p className="text-surface-100 text-sm font-medium truncate">{user?.email || 'N/A'}</p>
            </div>

            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-xs font-medium text-surface-200/40 uppercase tracking-wider">Role</span>
              </div>
              <p className="text-surface-100 text-sm font-medium capitalize">{user?.role || 'student'}</p>
            </div>

            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium text-surface-200/40 uppercase tracking-wider">Member since</span>
              </div>
              <p className="text-surface-100 text-sm font-medium">{memberSince}</p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            NEW SECTIONS START HERE — everything below is added
           ══════════════════════════════════════════════════════════════ */}

        {/* Stat Cards Row */}
        <div className="mt-6">
          <StatCardsSection />
        </div>

        {/* Score Trend + Weakness Summary — side by side on large screens */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScoreTrendSection />
          <WeaknessSection />
        </div>

        {/* Session History */}
        <div className="mt-6">
          <SessionHistorySection />
        </div>

        {/* Quick Actions — kept from the original placeholder, "View Progress"
            button removed since the dashboard itself now IS the progress view */}
        <div className="mt-6 glass-card rounded-2xl p-6 sm:p-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <button
            onClick={() => navigate('/home')}
            className="group w-full sm:w-auto rounded-xl bg-white/[0.03] border border-white/5 hover:border-primary-500/30 p-5 text-left transition-all duration-200 hover:bg-primary-500/5 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center mb-3 group-hover:bg-primary-500/20 transition-colors">
              <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-white mb-1">Start New Interview</h4>
            <p className="text-xs text-surface-200/40">Practice with AI-powered mock interviews</p>
          </button>
        </div>
      </main>
    </div>
  );
}
