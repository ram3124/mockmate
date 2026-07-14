import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// =============================================================================
// RegisterPage
// =============================================================================
// Handles new user registration with client-side validation BEFORE hitting
// the API. On success, the user is automatically logged in and redirected.
// =============================================================================

/**
 * Validates registration form fields and returns an object of field-level
 * error messages. Returns an empty object if all fields are valid.
 *
 * @param {{ name: string, email: string, password: string }} fields
 * @returns {{ name?: string, email?: string, password?: string }}
 */
function validateFields({ name, email, password }) {
  const errors = {};

  if (!name.trim()) {
    errors.name = 'Name is required';
  }

  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!email.includes('@')) {
    errors.email = 'Please enter a valid email address';
  }

  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }

  return errors;
}

/**
 * Extracts a human-readable error message from an Axios error response.
 *
 * @param {Error} err
 * @returns {string}
 */
function extractErrorMessage(err) {
  return (
    err.response?.data?.message ||
    err.response?.data?.error ||
    'Registration failed. Please try again.'
  );
}

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Keeping fieldErrors local for inline validations while apiError is offloaded to react-hot-toast
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  /**
   * Handles form submission: validates locally first, then calls the API.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Run client-side validation first
    const errors = validateFields({ name, email, password });
    setFieldErrors(errors);

    // If any field has an error, stop here — don't waste an API call
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await register(name, email, password);
      toast.success('Registration successful!');

      // Registration in MockMate automatically logs the user in (the server
      // returns a JWT from the register endpoint), so we redirect straight
      // to the dashboard — no need to visit the login page first.
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center px-4 py-8 sm:py-12 relative overflow-x-hidden">
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
            Create your account
          </p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Name Field */}
          <div>
            <label htmlFor="register-name" className="block text-xs sm:text-sm font-medium text-surface-200/80 mb-1.5">
              Full name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-surface-200/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                id="register-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="John Doe"
                className={`w-full pl-10 sm:pl-11 pr-4 py-2 sm:py-2.5 text-sm sm:text-base rounded-xl bg-white/5 border text-surface-100 placeholder-surface-200/30 focus:outline-none transition-all duration-200 ${
                  fieldErrors.name
                    ? 'border-red-500/50 focus:border-red-400'
                    : 'border-white/10 focus:border-primary-500'
                }`}
              />
            </div>
            {fieldErrors.name && (
              <p className="mt-1.5 text-xs text-red-400">{fieldErrors.name}</p>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="register-email" className="block text-xs sm:text-sm font-medium text-surface-200/80 mb-1.5">
              Email address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-surface-200/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                placeholder="you@example.com"
                className={`w-full pl-10 sm:pl-11 pr-4 py-2 sm:py-2.5 text-sm sm:text-base rounded-xl bg-white/5 border text-surface-100 placeholder-surface-200/30 focus:outline-none transition-all duration-200 ${
                  fieldErrors.email
                    ? 'border-red-500/50 focus:border-red-400'
                    : 'border-white/10 focus:border-primary-500'
                }`}
              />
            </div>
            {fieldErrors.email && (
              <p className="mt-1.5 text-xs text-red-400">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="register-password" className="block text-xs sm:text-sm font-medium text-surface-200/80 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-surface-200/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                placeholder="••••••••"
                className={`w-full pl-10 sm:pl-11 pr-4 py-2 sm:py-2.5 text-sm sm:text-base rounded-xl bg-white/5 border text-surface-100 placeholder-surface-200/30 focus:outline-none transition-all duration-200 ${
                  fieldErrors.password
                    ? 'border-red-500/50 focus:border-red-400'
                    : 'border-white/10 focus:border-primary-500'
                }`}
              />
            </div>
            {fieldErrors.password ? (
              <p className="mt-1.5 text-xs text-red-400">{fieldErrors.password}</p>
            ) : (
              <p className="mt-1.5 text-[11px] sm:text-xs text-surface-200/40">Must be at least 6 characters</p>
            )}
          </div>

          {/* Submit Button */}
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
                <span>Creating account…</span>
              </>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        {/* Footer — Link to login */}
        <p className="mt-5 sm:mt-6 text-center text-xs sm:text-sm text-surface-200/50">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-primary-400 hover:text-primary-300 font-medium transition-colors duration-200"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}