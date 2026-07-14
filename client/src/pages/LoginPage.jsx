import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// =============================================================================
// LoginPage
// =============================================================================
// Handles user authentication with email + password. On successful login,
// redirects based on user role (admin → admin panel, student → dashboard).
// =============================================================================

/**
 * Extracts a human-readable error message from an Axios error response.
 * Why a helper instead of inline: The error extraction logic is non-trivial
 * (multiple fallback paths) and would clutter the handleSubmit try/catch.
 *
 * @param {Error} err - The error thrown by the login API call
 * @returns {string} A user-facing error message
 */
function extractErrorMessage(err) {
  // The backend may return the error in different shapes depending on which
  // middleware caught it (express-validator vs custom error handler)
  return (
    err.response?.data?.message ||
    err.response?.data?.error ||
    'Login failed. Please check your credentials and try again.'
  );
}

export default function LoginPage() {
  // Why separate useState for each field instead of one formData object:
  // With individual state, React only re-renders what changed. A single
  // object would require spreading {...prev, [field]: value} on every
  // keystroke, which is marginally more allocation. For a 2-field form,
  // individual state is simpler and more readable.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Why separate isSubmitting state:
  // isSubmitting: Controls button disabled state and loading spinner. Prevents
  //               double-submission if the user clicks rapidly.
  // Note: The previous local error state banner has been migrated to 
  // transient toast notifications to keep errors clean and self-expiring.
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  /**
   * Handles form submission. Calls the auth context's login function,
   * then redirects based on the returned user's role.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const data = await login(email, password);

      // Trigger transient success toast on successful login completion
      toast.success('Welcome back!');

      // Why role-based redirect: Admin users need to land on the admin panel
      // (question management), not the student dashboard. Sending everyone
      // to /dashboard would force admins to manually navigate every time.
      if (data.user?.role === 'admin') {
        navigate('/admin/questions', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      // Catch transient errors and present them instantly using a toast error
      toast.error(extractErrorMessage(err));
    } finally {
      // Always reset submitting state so the button becomes clickable again,
      // even if the request failed
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center px-4 py-8 sm:py-12 relative overflow-x-hidden">
      {/* 
        Mobile Responsive Polish Pass:
        Changed padding from fixed 'p-8' to fluid 'p-6 sm:p-8' to protect 
        layout space on 375px wide viewports like the iPhone SE.
      */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 w-full max-w-md animate-fade-in-up relative z-10 my-auto">
        {/* Logo & Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 mb-3 sm:mb-4 shadow-lg shadow-primary-500/25">
            <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary-300 via-primary-400 to-violet-400 bg-clip-text text-transparent tracking-tight">
            MockMate
          </h1>
          <p className="text-surface-200/60 mt-1 sm:mt-2 text-xs sm:text-sm">
            Sign in to your account
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Email Field */}
          <div>
            <label htmlFor="login-email" className="block text-xs sm:text-sm font-medium text-surface-200/80 mb-1.5">
              Email address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-surface-200/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 sm:pl-11 pr-4 py-2 sm:py-2.5 text-sm sm:text-base rounded-xl bg-white/5 border border-white/10 text-surface-100 placeholder-surface-200/30 focus:outline-none focus:border-primary-500 transition-all duration-200"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="login-password" className="block text-xs sm:text-sm font-medium text-surface-200/80 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-surface-200/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 sm:pl-11 pr-4 py-2 sm:py-2.5 text-sm sm:text-base rounded-xl bg-white/5 border border-white/10 text-surface-100 placeholder-surface-200/30 focus:outline-none focus:border-primary-500 transition-all duration-200"
              />
            </div>
          </div>

          {/* Submit Button — disabled during submission to prevent double-clicks */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-violet-600 text-white font-semibold text-sm sm:text-base hover:from-primary-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-surface-950 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary-600/20 hover:shadow-primary-500/30"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Signing in…</span>
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Footer — Link to registration */}
        <p className="mt-5 sm:mt-6 text-center text-xs sm:text-sm text-surface-200/50">
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="text-primary-400 hover:text-primary-300 font-medium transition-colors duration-200"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}