import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLeaderboard, getMyRank } from '../services/api';

// =============================================================================
// Hardcoded Enums (Synchronized directly from HomePage conventions)
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

function extractErrorMessage(err) {
  return (
    err.response?.data?.message ||
    err.response?.data?.error ||
    'Failed to gather standings. Verify your connection and try again.'
  );
}

export default function LeaderboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ── State Management ───────────────────────────────────────────────────
  const [filterCompany, setFilterCompany] = useState('');
  const [filterType, setFilterType] = useState('');
  
  const [rankings, setRankings] = useState([]);
  const [myRankInfo, setMyRankInfo] = useState(null);
  
  const [isLoadingTable, setIsLoadingTable] = useState(true);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // ── Fetch Personal Percentile Card Context ──────────────────────────────
  useEffect(() => {
    let isMounted = true; // Protect against unmounting mid-fetch
    
    const fetchPersonalRank = async () => {
      try {
        const response = await getMyRank();
        if (isMounted) {
          setMyRankInfo(response.data);
        }
      } catch (err) {
        // Log locally or handle silently if user has no metrics yet
        console.error('Error getting personal rank summary context:', err);
      } finally {
        if (isMounted) {
          setIsLoadingMeta(false);
        }
      }
    };
    
    fetchPersonalRank();
    
    return () => {
      isMounted = false; // Cleanup if user navigates away before API finishes
    };
  }, []);

  // ── Fetch Global Standings List with Filter Parameters ──────────────────
  useEffect(() => {
    let isCurrentFetchValid = true;
    const fetchLeaderboardData = async () => {
      setIsLoadingTable(true);
      setErrorMessage('');
      
      try {
        const params = {};
        if (filterCompany) params.company = filterCompany;
        if (filterType) params.type = filterType;

        const response = await getLeaderboard(params);
        
        // Prevent race condition overwrites if filter variables shift before resolve finishes
        if (isCurrentFetchValid) {
          setRankings(Array.isArray(response.data) ? response.data : response.data?.leaderboard || []);
        }
      } catch (err) {
        if (isCurrentFetchValid && err.response?.status !== 401) {
          setErrorMessage(extractErrorMessage(err));
        }
      } finally {
        if (isCurrentFetchValid) {
          setIsLoadingTable(false);
        }
      }
    };

    fetchLeaderboardData();

    // Cleanup hook tracking state resets during intermediate component swaps
    return () => {
      isCurrentFetchValid = false;
    };
  }, [filterCompany, filterType]);

  return (
    <div className="min-h-screen bg-surface-900 text-surface-100 relative">
      {/* ── Top Navigation Header Bar ──────────────────────────────────── */}
      <nav className="border-b border-white/5 bg-white/[0.02] backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-md shadow-primary-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-primary-300 to-violet-400 bg-clip-text text-transparent cursor-pointer" onClick={() => navigate('/dashboard')}>
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
              onClick={() => navigate('/home')}
              className="px-4 py-2 rounded-xl text-sm font-medium text-surface-200/70 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-200 cursor-pointer"
            >
              Start Interview
            </button>
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
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Title Block */}
        <div className="animate-fade-in-up mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <span>Global Leaderboard</span>
            <span className="text-2xl">🏆</span>
          </h1>
          <p className="text-surface-200/50 text-base">
            Compare cumulative evaluation metrics against active engineering students peer-to-peer.
          </p>
        </div>

        {/* ── Highlighted Percentile Banner Card ──────────────────────── */}
        {!isLoadingMeta && (
          <div className="animate-fade-in-up mb-8">
            {myRankInfo && myRankInfo.hasRank !== false && myRankInfo.percentile !== undefined ? (
              <div className="glass-card rounded-2xl p-6 border border-primary-500/20 bg-gradient-to-r from-primary-500/10 to-violet-500/5 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold tracking-wider text-primary-300 uppercase mb-1">Your Standing Status</h3>
                  <p className="text-xl font-bold text-white leading-tight">
                    You scored higher than <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-300 to-violet-300 font-extrabold text-2xl">{myRankInfo.percentile}%</span> of active students.
                  </p>
                  <p className="text-xs text-surface-200/40 mt-1">
                    Absolute Rank: #{myRankInfo.rank || '--'} out of {myRankInfo.totalStudents || '--'} total participants.
                  </p>
                </div>
                <div className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/5 font-mono text-xs text-surface-200/60 shrink-0">
                  ⚡ Tier: {myRankInfo.percentile >= 90 ? 'Elite Developer' : myRankInfo.percentile >= 70 ? 'Competent' : 'Rising Star'}
                </div>
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-6 border border-amber-500/10 bg-white/[0.01] backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold tracking-wider text-amber-400/80 uppercase mb-1">Unranked Profile</h3>
                  <p className="text-base font-medium text-surface-200/70">
                    Complete your first mock interview to see your rank and percentile metrics here!
                  </p>
                </div>
                <button
                  onClick={() => navigate('/home')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-500 hover:to-violet-500 text-white font-semibold text-sm transition-all duration-200 cursor-pointer shadow-md shadow-primary-600/10 shrink-0"
                >
                  Launch Live Session
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Interactive Custom Filters ───────────────────────────────── */}
        <div className="glass-card rounded-2xl p-5 mb-8 border border-white/5 bg-white/[0.01] backdrop-blur-xl grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          <div>
            <label className="block text-xs font-semibold text-surface-200/50 uppercase tracking-wider mb-2">Target Company Filter</label>
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-surface-200 p-3 text-sm focus:outline-none focus:border-primary-500 transition-colors"
            >
              <option value="" className="bg-surface-950 text-surface-200">All Target Companies (Unfiltered)</option>
              {COMPANIES.map((c) => (
                <option key={c.value} value={c.value} className="bg-surface-950 text-surface-100">
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-200/50 uppercase tracking-wider mb-2">Core Technical Domain</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-surface-200 p-3 text-sm focus:outline-none focus:border-primary-500 transition-colors"
            >
              <option value="" className="bg-surface-950 text-surface-200">All Tracks / Framework Domains</option>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value} className="bg-surface-950 text-surface-100">
                  {t.label} — {t.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Rankings Table Space ────────────────────────────────────── */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {isLoadingTable ? (
            <div className="py-20 text-center">
              <svg className="animate-spin h-8 w-8 text-primary-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-surface-200/40 text-sm font-medium">Re-calculating weighted database positions...</p>
            </div>
          ) : errorMessage ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm text-center">
              ❌ {errorMessage}
            </div>
          ) : rankings.length === 0 ? (
            <div className="glass-card rounded-2xl py-16 px-4 text-center border border-white/5 bg-white/[0.01]">
              <div className="text-4xl mb-3">📁</div>
              <h3 className="text-lg font-semibold text-white mb-1">No Placements Tracked</h3>
              <p className="text-surface-200/40 text-sm max-w-sm mx-auto">
                No mock scores match this specific company and track combination yet. Be the first to build an assessment trace!
              </p>
            </div>
          ) : (
            <div className="glass-card rounded-2xl overflow-hidden border border-white/5 bg-white/[0.01] backdrop-blur-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-semibold uppercase text-surface-200/40 tracking-wider">
                      <th className="py-4 px-6 text-center w-20">Rank</th>
                      <th className="py-4 px-6">Candidate Node</th>
                      <th className="py-4 px-6 text-right w-40">Cumulative Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {rankings.map((item, index) => {
                      // Normalize position indexes
                      const displayRank = item.rank || (index + 1);
                      // Check matching identities safely via fields provided by typical backend models
                      const isMe = item.isCurrentUser || item.userId === user?._id;

                      return (
                        <tr
                          key={item._id || index}
                          className={`transition-colors duration-150 ${
                            isMe
                              ? 'bg-primary-500/10 hover:bg-primary-500/15 font-medium border-y border-primary-500/20'
                              : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="py-4 px-6 text-center">
                            {displayRank === 1 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-surface-950 font-bold text-xs shadow-md shadow-amber-400/20">1st</span>
                            ) : displayRank === 2 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-surface-950 font-bold text-xs shadow-md shadow-slate-300/20">2nd</span>
                            ) : displayRank === 3 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-surface-100 font-bold text-xs shadow-md shadow-amber-700/20">3rd</span>
                            ) : (
                              <span className="font-mono text-surface-200/50">#{displayRank}</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <span className={isMe ? 'text-primary-300 font-semibold' : 'text-surface-100'}>
                                {item.name || 'Anonymous Peer'}
                              </span>
                              {isMe && (
                                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-primary-400/20 text-primary-300 border border-primary-400/30">
                                  You
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-bold text-surface-100">
                            {item.score !== undefined ? Math.round(item.score) : '--'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}