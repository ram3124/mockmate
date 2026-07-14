import axios from 'axios';

// =============================================================================
// Axios Instance
// =============================================================================
// Why a custom instance instead of using axios directly: A shared instance
// lets us configure baseURL, headers, and interceptors in ONE place. Every
// component and service that imports `api` gets consistent config without
// repeating it. This also keeps raw Axios calls out of React components,
// making them easier to test and refactor.
// =============================================================================
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// =============================================================================
// Request Interceptor — Attach Auth Token
// =============================================================================
// Why an interceptor instead of manually adding headers in every call:
// The token needs to be on EVERY authenticated request. Doing it here
// guarantees no component forgets to include it, and if the storage key
// changes we only update one line.
// =============================================================================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mockmate_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// =============================================================================
// Response Interceptor — Handle 401 Globally
// =============================================================================
// Why window.location.href instead of React Router's useNavigate():
// This interceptor runs OUTSIDE the React component tree — it's plain JS
// attached to the Axios instance at module level. React hooks like
// useNavigate() can only be called inside React components or custom hooks.
// window.location.href is the only reliable way to redirect from non-React
// code. The downside is a full page reload, but that's acceptable for a
// "your session expired" scenario since we want a clean state anyway.
// =============================================================================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear all auth data — the token is expired or invalid
      localStorage.removeItem('mockmate_token');
      localStorage.removeItem('mockmate_user');

      // Only redirect if we're NOT already on the login page (prevents
      // infinite redirect loops when the login API itself returns 401)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// =============================================================================
// Named API Functions
// =============================================================================
// Why named exports instead of letting components call api.post() directly:
// 1. Components stay decoupled from endpoint URLs — if /auth/login changes
//    to /auth/signin, we update ONE function, not every component.
// 2. Easier to mock in tests — jest.mock('./services/api') replaces these
//    functions cleanly.
// 3. Keeps components focused on UI logic, not HTTP plumbing.
// =============================================================================

/**
 * Register a new user account.
 * @param {{ name: string, email: string, password: string }} data
 * @returns {Promise<{ token: string, user: object }>}
 */
export const registerUser = (data) => api.post('/auth/register', data);

/**
 * Log in with existing credentials.
 * @param {{ email: string, password: string }} data
 * @returns {Promise<{ token: string, user: object }>}
 */
export const loginUser = (data) => api.post('/auth/login', data);

/**
 * Fetch the currently authenticated user's profile.
 * Relies on the request interceptor to attach the token.
 * @returns {Promise<{ user: object }>}
 */
export const getCurrentUser = () => api.get('/auth/me');

// =============================================================================
// Session API Functions
// =============================================================================

/**
 * Check if the logged-in user has an active (in-progress) session.
 * Returns { session: null } if no active session exists.
 * @returns {Promise<{ success, session, totalAllowedTimeSeconds?, remainingTimeSeconds? }>}
 */
export const getActiveSession = () => api.get('/sessions/active');

/**
 * Start a new mock interview session or resume an existing one.
 * @param {{ company: string, type: string, count?: number, difficulty?: string }} data
 * @returns {Promise<{ success, session, totalAllowedTimeSeconds, remainingTimeSeconds }>}
 */
export const startSession = (data) => api.post('/sessions/start', data);


// =============================================================================
// Session API Functions (Remaining)
// =============================================================================

export const submitAnswer = (sessionId, data) =>
  api.post(`/sessions/${sessionId}/answer`, data);

export const completeSession = (sessionId) =>
  api.post(`/sessions/${sessionId}/complete`);

export const evaluateSession = (sessionId) =>
  api.post(`/sessions/${sessionId}/evaluate`);

export const getSessionReport = (sessionId) =>
  api.get(`/sessions/${sessionId}/report`);

// =============================================================================
// Dashboard API
// =============================================================================

export const getDashboardStats = () =>
  api.get('/analytics/dashboard');

export const getWeaknessAnalysis = () =>
  api.get('/analytics/weaknesses');

export const getScoreTrend = () =>
  api.get('/analytics/trend');

export const getSessionHistory = () =>
  api.get('/sessions/history');

// =============================================================================
// Leaderboard API
// =============================================================================

export const getLeaderboard = (params) =>
  api.get('/leaderboard', { params });

export const getMyRank = () =>
  api.get('/leaderboard/my-rank');


// =============================================================================
// Admin Question Bank API
// =============================================================================

/**
 * Fetch all questions (Admin only)
 */
export const getAdminQuestions = () =>
  api.get('/questions');

/**
 * Create a new question (Admin only)
 */
export const createQuestion = (data) =>
  api.post('/questions', data);

/**
 * Update an existing question (Admin only)
 */
export const updateQuestion = (questionId, data) =>
  api.put(`/questions/${questionId}`, data);

/**
 * Delete a question (Admin only)
 */
export const deleteQuestion = (questionId) =>
  api.delete(`/questions/${questionId}`);

export default api;
